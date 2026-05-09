"""Signal handlers for cross-module side effects."""
import logging

from django.dispatch import receiver

from .signals import (
    member_registered,
    parcel_status_changed,
    payment_confirmed,
    purchase_order_created,
    waybill_shipped,
)

logger = logging.getLogger(__name__)


@receiver(parcel_status_changed)
def log_parcel_status_change(sender, parcel, old_status, new_status, **kwargs):
    logger.info("Parcel %s status changed: %s -> %s", parcel.pk, old_status, new_status)


@receiver(waybill_shipped)
def log_waybill_shipped(sender, waybill, **kwargs):
    logger.info("Waybill %s marked as shipped", waybill.pk)


@receiver(purchase_order_created)
def log_purchase_created(sender, order, **kwargs):
    logger.info("Purchase order %s created", order.pk)


@receiver(payment_confirmed)
def log_payment_confirmed(sender, receivable, **kwargs):
    logger.info("Payment confirmed for receivable %s", receivable.pk)


@receiver(member_registered)
def log_member_registered(sender, user, **kwargs):
    logger.info("New member registered: id=%s", user.pk)
