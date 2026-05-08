from rest_framework import serializers

from .models import FileUsage, StoredFile


class StoredFileSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = StoredFile
        fields = [
            "file_id",
            "usage",
            "owner_type",
            "original_name",
            "content_type",
            "size_bytes",
            "status",
            "download_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_download_url(self, obj: StoredFile) -> str:
        scope = self.context.get("scope", "member")
        prefix = "admin/files" if scope == "admin" else "files"
        return f"/api/v1/{prefix}/{obj.file_id}/download"


class FileUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    usage = serializers.ChoiceField(choices=FileUsage.choices)
