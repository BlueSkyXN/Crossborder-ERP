"""Domain event signals for cross-module decoupling.

Low-risk side effects only: audit trail enrichment, notification enqueue,
cache invalidation. NOT for finance/payment/state transitions.
"""
import django.dispatch

# Parcel lifecycle
parcel_received = django.dispatch.Signal()       # sender=Parcel, parcel=instance
parcel_status_changed = django.dispatch.Signal()  # sender=Parcel, parcel=instance, old_status, new_status

# Waybill lifecycle
waybill_created = django.dispatch.Signal()        # sender=Waybill, waybill=instance
waybill_shipped = django.dispatch.Signal()        # sender=Waybill, waybill=instance

# Purchase lifecycle
purchase_order_created = django.dispatch.Signal()  # sender=PurchaseOrder, order=instance
purchase_order_completed = django.dispatch.Signal()

# Finance events
payment_confirmed = django.dispatch.Signal()       # sender=Receivable, receivable=instance
refund_issued = django.dispatch.Signal()

# Member events
member_registered = django.dispatch.Signal()       # sender=User, user=instance
