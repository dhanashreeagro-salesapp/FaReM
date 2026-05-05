from rest_framework import viewsets, serializers
from rest_framework.permissions import IsAuthenticated
from .models import ImportJob

class ImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportJob
        fields = '__all__'

class ImportJobViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Status polling for bulk imports.
    """
    queryset = ImportJob.objects.all()
    serializer_class = ImportJobSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(created_by=self.request.user)

    from rest_framework.decorators import action
    from rest_framework.response import Response
    from rest_framework import status

    @action(detail=True, methods=['get'])
    def download_results(self, request, pk=None):
        job = self.get_object()
        import os
        from django.http import HttpResponse

        if not os.path.exists(job.filename):
            return Response({"error": "Results file not found"}, status=status.HTTP_404_NOT_FOUND)

        with open(job.filename, 'rb') as f:
            file_data = f.read()

        response = HttpResponse(
            file_data,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="import_results_{job.id}.xlsx"'
        return response
