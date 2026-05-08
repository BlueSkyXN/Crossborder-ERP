from django.db import models


class AddressType(models.TextChoices):
    RECIPIENT = "RECIPIENT", "收件人"
    DECLARANT = "DECLARANT", "申报人"
    CONTACT = "CONTACT", "联系人"
    SENDER = "SENDER", "寄件人"


class Address(models.Model):
    user = models.ForeignKey("members.User", on_delete=models.CASCADE, related_name="addresses")
    address_type = models.CharField(max_length=30, choices=AddressType.choices, default=AddressType.RECIPIENT)
    contact_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=30)
    country_region = models.CharField(max_length=80, blank=True)
    province_city = models.CharField(max_length=120, blank=True)
    detail_address = models.TextField()
    postal_code = models.CharField(max_length=30, blank=True)
    company = models.CharField(max_length=120, blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "addresses"
        ordering = ["-is_default", "-id"]
        indexes = [
            models.Index(fields=["user", "address_type", "is_active"], name="idx_addr_user_type_active"),
        ]

    def __str__(self) -> str:
        return f"{self.get_address_type_display()} - {self.contact_name}"
