from django.db import models


class RegionLevel(models.TextChoices):
    COUNTRY = "COUNTRY", "国家"
    PROVINCE = "PROVINCE", "省/州"
    CITY = "CITY", "城市"
    DISTRICT = "DISTRICT", "区/县"
    ZONE = "ZONE", "区域"


class CountryRegion(models.Model):
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, related_name="children",
        null=True, blank=True,
    )
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=20, unique=True)
    iso_code = models.CharField(max_length=10, blank=True, help_text="ISO 3166 alpha-2/3")
    phone_code = models.CharField(max_length=10, blank=True, help_text="国际区号")
    currency_code = models.CharField(max_length=10, blank=True)
    level = models.CharField(max_length=20, choices=RegionLevel.choices, default=RegionLevel.COUNTRY)
    postal_code = models.CharField(max_length=20, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "country_regions"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["parent", "name"], name="uq_region_parent_name"),
        ]

    def __str__(self) -> str:
        return f"{self.code} - {self.name}"

    @property
    def full_path(self) -> str:
        parts = [self.name]
        node = self.parent
        while node:
            parts.insert(0, node.name)
            node = node.parent
        return " / ".join(parts)
