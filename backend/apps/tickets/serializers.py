from rest_framework import serializers

from apps.files.models import StoredFile

from .models import Ticket, TicketMessage, TicketStatus, TicketType


class TicketMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    file_download_url = serializers.SerializerMethodField()

    class Meta:
        model = TicketMessage
        fields = [
            "id",
            "sender_type",
            "sender_name",
            "content",
            "file_id",
            "file_name",
            "file_download_url",
            "created_at",
        ]
        read_only_fields = fields

    def get_sender_name(self, obj: TicketMessage) -> str:
        if obj.sender_type == "ADMIN":
            return obj.admin_user.name if obj.admin_user else "客服"
        if obj.member and hasattr(obj.member, "profile"):
            return obj.member.profile.display_name or obj.member.email
        return obj.member.email if obj.member else "会员"

    def _file(self, obj: TicketMessage) -> StoredFile | None:
        if not obj.file_id:
            return None
        cache_key = "_serialized_file"
        if hasattr(obj, cache_key):
            return getattr(obj, cache_key)
        stored_file = StoredFile.objects.filter(file_id=obj.file_id).first()
        setattr(obj, cache_key, stored_file)
        return stored_file

    def get_file_name(self, obj: TicketMessage) -> str:
        stored_file = self._file(obj)
        return stored_file.original_name if stored_file else ""

    def get_file_download_url(self, obj: TicketMessage) -> str:
        if not obj.file_id:
            return ""
        scope = self.context.get("scope", "member")
        prefix = "admin/files" if scope == "admin" else "files"
        return f"/api/v1/{prefix}/{obj.file_id}/download"


class TicketSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    handled_by_name = serializers.CharField(source="handled_by.name", read_only=True, allow_null=True)
    messages = TicketMessageSerializer(many=True, read_only=True)

    class Meta:
        model = Ticket
        fields = [
            "id",
            "ticket_no",
            "user",
            "user_email",
            "type",
            "status",
            "title",
            "handled_by_name",
            "closed_at",
            "last_message_at",
            "created_at",
            "updated_at",
            "messages",
        ]
        read_only_fields = fields


class TicketCreateSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=TicketType.choices, default=TicketType.GENERAL)
    title = serializers.CharField(max_length=160)
    content = serializers.CharField()
    file_id = serializers.CharField(max_length=40, required=False, allow_blank=True)


class TicketMessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField()
    file_id = serializers.CharField(max_length=40, required=False, allow_blank=True)


class TicketCloseSerializer(serializers.Serializer):
    content = serializers.CharField(required=False, allow_blank=True)


class TicketStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=TicketStatus.choices)
