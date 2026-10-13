"""
Crop & Geography Intelligence API
----------------------------------
Additive-only reporting view. Reads from existing models only.
No existing view, model, or permission is changed.
"""

import datetime
from collections import defaultdict

from django.db.models import Count, Sum, Q, Avg
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Farmer,
    Role,
    Plot,
    CropSeason,
    CropStage,
    CropMaster,
    MarketRate,
    Territory,
    User,
)


def _get_scoped_farmer_qs(user):
    """
    Return a Farmer queryset scoped to the logged-in user's visibility.
    Mirrors the logic already used in DashboardAPIView / ActiveCropsAPIView.
    """
    farmers = Farmer.objects.exclude(status__iexact="Inactive")

    if user.role in [Role.ADMIN, Role.CONTENT_TEAM]:
        return farmers  # Admin sees all

    from django.core.cache import cache

    cache_key = "territory_children_map"
    children_map = cache.get(cache_key)
    if children_map is None:
        all_territories = Territory.objects.exclude(
            status__iexact="Inactive"
        ).values_list("id", "parent_territory_id")
        children_map = {}
        for t_id, p_id in all_territories:
            children_map.setdefault(p_id, []).append(t_id)
        cache.set(cache_key, children_map, 60)

    root_t_ids = []
    if user.territory_id:
        root_t_ids.append(user.territory_id)
    root_t_ids.extend(list(user.managed_territories.values_list("id", flat=True)))

    visited_t = set()
    t_queue = list(root_t_ids)
    while t_queue:
        curr = t_queue.pop(0)
        if curr in visited_t:
            continue
        visited_t.add(curr)
        t_queue.extend(children_map.get(curr, []))

    team_user_ids = [u.id for u in user.get_team_users()]
    q_filter = Q(assigned_staff_id__in=team_user_ids)
    if visited_t:
        q_filter |= Q(territory_id__in=visited_t)

    return farmers.filter(q_filter)


class CropIntelligenceAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # --- Optional filters from query params ---
        f_village = request.query_params.get("village", "").strip()
        f_taluka = request.query_params.get("taluka", "").strip()
        f_district = request.query_params.get("district", "").strip()
        f_crop_id = request.query_params.get("crop_id", "").strip()
        f_stage_name = request.query_params.get("stage_name", "").strip()
        f_staff_id = request.query_params.get("staff_id", "").strip()

        # --- 1. Scoped farmer queryset ---
        farmers = _get_scoped_farmer_qs(user)

        if f_village:
            farmers = farmers.filter(village__iexact=f_village)
        if f_taluka:
            farmers = farmers.filter(taluka__iexact=f_taluka)
        if f_district:
            farmers = farmers.filter(district__iexact=f_district)
        if f_staff_id:
            farmers = farmers.filter(assigned_staff_id=f_staff_id)

        farmer_ids = list(farmers.values_list("id", flat=True))

        # --- 2. Active plots for these farmers ---
        plots_qs = Plot.objects.filter(farmer_id__in=farmer_ids, is_active=True)
        total_plots = plots_qs.count()

        # --- 3. Active crop seasons ---
        seasons_qs = CropSeason.objects.filter(
            plot__farmer_id__in=farmer_ids, plot__is_active=True, status="Active"
        ).select_related("crop", "current_stage", "plot", "plot__farmer")

        if f_crop_id:
            seasons_qs = seasons_qs.filter(crop_id=f_crop_id)
        if f_stage_name:
            seasons_qs = seasons_qs.filter(current_stage__stage_name__iexact=f_stage_name)

        # Materialise seasons once for reuse
        seasons = list(
            seasons_qs.values(
                "id",
                "crop_id",
                "crop__crop_name",
                "current_stage__stage_name",
                "current_stage__sequence_number",
                "area_acres",
                "plot__area_acres",
                "plot__farmer_id",
                "plot__farmer__full_name",
                "plot__farmer__village",
                "plot__farmer__taluka",
                "plot__farmer__district",
                "plot__farmer__primary_mobile",
                "plot__farmer__assigned_staff_id",
            )
        )

        # ------------------------------------------------------------------ #
        # Helper: effective acreage for a season row
        # ------------------------------------------------------------------ #
        def acres(s):
            return float(s["area_acres"] or s["plot__area_acres"] or 0)

        # ------------------------------------------------------------------ #
        # KPIs
        # ------------------------------------------------------------------ #
        total_cultivated_acres = sum(acres(s) for s in seasons)
        distinct_crops = len(set(s["crop_id"] for s in seasons if s["crop_id"]))
        total_seasons = len(seasons)

        kpis = {
            "total_farmers": len(farmer_ids),
            "total_active_plots": total_plots,
            "total_cultivated_acres": round(total_cultivated_acres, 2),
            "total_distinct_crops": distinct_crops,
            "total_active_seasons": total_seasons,
        }

        # ------------------------------------------------------------------ #
        # Crop Acreage Analysis
        # ------------------------------------------------------------------ #
        crop_acreage_map = defaultdict(lambda: {"acres": 0.0, "count": 0, "crop_id": None})
        for s in seasons:
            cn = s["crop__crop_name"] or "Unknown"
            crop_acreage_map[cn]["acres"] += acres(s)
            crop_acreage_map[cn]["count"] += 1
            crop_acreage_map[cn]["crop_id"] = str(s["crop_id"]) if s["crop_id"] else None

        crop_acreage = sorted(
            [
                {
                    "crop_name": k,
                    "crop_id": v["crop_id"],
                    "total_acres": round(v["acres"], 2),
                    "season_count": v["count"],
                    "pct_of_total": round((v["acres"] / total_cultivated_acres * 100), 1)
                    if total_cultivated_acres > 0
                    else 0,
                }
                for k, v in crop_acreage_map.items()
            ],
            key=lambda x: x["total_acres"],
            reverse=True,
        )

        # ------------------------------------------------------------------ #
        # Growth Stage Distribution
        # ------------------------------------------------------------------ #
        stage_dist_map = defaultdict(lambda: defaultdict(lambda: {"count": 0, "acres": 0.0}))
        for s in seasons:
            cn = s["crop__crop_name"] or "Unknown"
            sn = s["current_stage__stage_name"] or "Unassigned"
            stage_dist_map[cn][sn]["count"] += 1
            stage_dist_map[cn][sn]["acres"] += acres(s)

        crop_stage_distribution = []
        for crop_name, stages in stage_dist_map.items():
            for stage_name, vals in stages.items():
                crop_stage_distribution.append(
                    {
                        "crop_name": crop_name,
                        "stage_name": stage_name,
                        "count": vals["count"],
                        "acres": round(vals["acres"], 2),
                    }
                )
        crop_stage_distribution.sort(key=lambda x: (x["crop_name"], x["stage_name"]))

        # ------------------------------------------------------------------ #
        # Geographic Summary
        # ------------------------------------------------------------------ #
        # Group seasons by village/taluka/district
        geo_map = defaultdict(lambda: {
            "farmer_ids": set(),
            "plot_ids": set(),
            "acres": 0.0,
            "crop_counts": defaultdict(int),
            "taluka": "",
            "district": "",
        })
        for s in seasons:
            village = s["plot__farmer__village"] or "Unknown"
            geo_map[village]["farmer_ids"].add(s["plot__farmer_id"])
            geo_map[village]["acres"] += acres(s)
            geo_map[village]["crop_counts"][s["crop__crop_name"] or "Unknown"] += 1
            geo_map[village]["taluka"] = s["plot__farmer__taluka"] or ""
            geo_map[village]["district"] = s["plot__farmer__district"] or ""

        # Also gather plot counts by village
        plot_village_counts = defaultdict(int)
        for p in plots_qs.select_related("farmer").values(
            "farmer__village"
        ).annotate(c=Count("id")):
            plot_village_counts[p["farmer__village"] or "Unknown"] += p["c"]

        geo_summary = sorted(
            [
                {
                    "village": village,
                    "taluka": data["taluka"],
                    "district": data["district"],
                    "farmer_count": len(data["farmer_ids"]),
                    "plot_count": plot_village_counts.get(village, 0),
                    "acres": round(data["acres"], 2),
                    "top_crops": sorted(
                        data["crop_counts"].items(), key=lambda x: x[1], reverse=True
                    )[:3],
                }
                for village, data in geo_map.items()
            ],
            key=lambda x: x["acres"],
            reverse=True,
        )

        # ------------------------------------------------------------------ #
        # Geo × Crop × Stage Matrix  (village × crop → count)
        # ------------------------------------------------------------------ #
        matrix_map = defaultdict(lambda: defaultdict(int))
        for s in seasons:
            village = s["plot__farmer__village"] or "Unknown"
            crop = s["crop__crop_name"] or "Unknown"
            matrix_map[village][crop] += 1

        # Only include top-20 villages by total season count and top-10 crops by acreage
        top_village_keys = sorted(
            matrix_map.keys(),
            key=lambda v: sum(matrix_map[v].values()),
            reverse=True,
        )[:20]
        top_crop_keys = [c["crop_name"] for c in crop_acreage[:10]]

        geo_crop_matrix = {
            "villages": top_village_keys,
            "crops": top_crop_keys,
            "cells": {
                village: {
                    crop: matrix_map[village].get(crop, 0)
                    for crop in top_crop_keys
                }
                for village in top_village_keys
            },
        }

        # ------------------------------------------------------------------ #
        # Fieldwork Opportunities
        # Priority = rising market price × acreage × early growth stage
        # ------------------------------------------------------------------ #
        today = timezone.now().date()
        thirty_days_ago = today - datetime.timedelta(days=30)

        # Fetch recent market rate trends for active crops
        active_crop_ids = list(set(s["crop_id"] for s in seasons if s["crop_id"]))
        market_trend_map = {}  # crop_id -> price_trend_score (positive = rising)

        if active_crop_ids:
            # Get last 2 market entries per crop to compute direction
            recent_rates = list(
                MarketRate.objects.filter(
                    crop_id__in=active_crop_ids, date__gte=thirty_days_ago
                )
                .values("crop_id", "avg_price", "date")
                .order_by("crop_id", "-date")
            )

            rates_by_crop = defaultdict(list)
            for r in recent_rates:
                if len(rates_by_crop[r["crop_id"]]) < 3:
                    rates_by_crop[r["crop_id"]].append(r)

            for crop_id, rates in rates_by_crop.items():
                if len(rates) >= 2 and rates[-1]["avg_price"] and rates[0]["avg_price"]:
                    latest = float(rates[0]["avg_price"])
                    oldest = float(rates[-1]["avg_price"])
                    if oldest > 0:
                        pct_change = (latest - oldest) / oldest * 100
                        market_trend_map[crop_id] = pct_change
                    else:
                        market_trend_map[crop_id] = 0.0
                else:
                    market_trend_map[crop_id] = 0.0

        # Score each season: score = price_trend_pct + (acres * 5) + (10 if early stage)
        # "Early stage" = sequence_number <= 2
        EARLY_STAGE_BONUS = 15.0
        ACRES_WEIGHT = 5.0

        opportunity_rows = []
        seen_farmer_crop = set()
        for s in seasons:
            crop_id = s["crop_id"]
            if not crop_id:
                continue
            fkey = (s["plot__farmer_id"], crop_id)
            if fkey in seen_farmer_crop:
                continue
            seen_farmer_crop.add(fkey)

            price_trend = market_trend_map.get(crop_id, 0.0)
            # Only surface crops with flat or rising prices (score >= 0)
            if price_trend < -10:  # skip sharply falling prices
                continue

            acreage = acres(s)
            seq = s["current_stage__sequence_number"] or 99
            early_bonus = EARLY_STAGE_BONUS if seq <= 2 else 0.0
            score = price_trend + (acreage * ACRES_WEIGHT) + early_bonus

            opportunity_rows.append(
                {
                    "farmer_id": str(s["plot__farmer_id"]),
                    "farmer_name": s["plot__farmer__full_name"],
                    "village": s["plot__farmer__village"] or "",
                    "district": s["plot__farmer__district"] or "",
                    "mobile": s["plot__farmer__primary_mobile"] or "",
                    "crop_name": s["crop__crop_name"] or "Unknown",
                    "crop_id": str(crop_id),
                    "stage_name": s["current_stage__stage_name"] or "Unassigned",
                    "stage_seq": seq,
                    "acres": round(acreage, 2),
                    "price_trend_pct": round(price_trend, 1),
                    "score": round(score, 1),
                }
            )

        fieldwork_opportunities = sorted(
            opportunity_rows, key=lambda x: x["score"], reverse=True
        )[:50]

        # ------------------------------------------------------------------ #
        # Filter options (unique values for the frontend filter bar)
        # ------------------------------------------------------------------ #
        geo_qs = farmers.exclude(village="").exclude(village__isnull=True)
        villages = sorted(
            set(geo_qs.values_list("village", flat=True).distinct())
        )
        talukas = sorted(
            set(geo_qs.values_list("taluka", flat=True).distinct())
        )
        districts = sorted(
            set(geo_qs.values_list("district", flat=True).distinct())
        )
        crops_list = list(
            CropMaster.objects.filter(status="Active")
            .values("id", "crop_name")
            .order_by("crop_name")
        )
        crops_list = [{"id": str(c["id"]), "name": c["crop_name"]} for c in crops_list]

        staff_list = []
        if user.role in [Role.ADMIN, Role.ZONAL_MANAGER, Role.TERRITORY_MANAGER]:
            team = user.get_team_users()
            for u in team:
                name_parts = [u.first_name or "", u.last_name or ""]
                name = " ".join(p for p in name_parts if p).strip() or u.email
                staff_list.append({"id": str(u.id), "name": name})

        filter_options = {
            "villages": villages,
            "talukas": talukas,
            "districts": districts,
            "crops": crops_list,
            "staff": staff_list,
        }

        return Response(
            {
                "kpis": kpis,
                "crop_acreage": crop_acreage,
                "crop_stage_distribution": crop_stage_distribution,
                "geo_summary": geo_summary,
                "geo_crop_matrix": geo_crop_matrix,
                "fieldwork_opportunities": fieldwork_opportunities,
                "filter_options": filter_options,
                "generated_at": today.isoformat(),
                "filters_applied": {
                    "village": f_village or None,
                    "taluka": f_taluka or None,
                    "district": f_district or None,
                    "crop_id": f_crop_id or None,
                    "stage_name": f_stage_name or None,
                    "staff_id": f_staff_id or None,
                },
            }
        )
