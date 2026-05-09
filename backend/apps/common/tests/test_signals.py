import logging
from types import SimpleNamespace

import pytest
from django.dispatch import Signal

from apps.common import signals


pytestmark = pytest.mark.django_db


def test_domain_signals_exist():
    signal_names = [
        "parcel_received",
        "parcel_status_changed",
        "waybill_created",
        "waybill_shipped",
        "purchase_order_created",
        "purchase_order_completed",
        "payment_confirmed",
        "refund_issued",
        "member_registered",
    ]

    for signal_name in signal_names:
        assert isinstance(getattr(signals, signal_name), Signal)


def test_domain_signals_can_be_sent_without_errors():
    parcel = SimpleNamespace(pk=101)
    waybill = SimpleNamespace(pk=202)
    order = SimpleNamespace(pk=303)
    receivable = SimpleNamespace(pk=404)
    user = SimpleNamespace(pk=505, email="member@example.com")

    signals.parcel_received.send(sender=object, parcel=parcel)
    signals.parcel_status_changed.send(sender=object, parcel=parcel, old_status="PENDING", new_status="RECEIVED")
    signals.waybill_created.send(sender=object, waybill=waybill)
    signals.waybill_shipped.send(sender=object, waybill=waybill)
    signals.purchase_order_created.send(sender=object, order=order)
    signals.purchase_order_completed.send(sender=object, order=order)
    signals.payment_confirmed.send(sender=object, receivable=receivable)
    signals.refund_issued.send(sender=object, receivable=receivable)
    signals.member_registered.send(sender=object, user=user)


def test_signal_handlers_produce_logs(caplog):
    caplog.set_level(logging.INFO, logger="apps.common.handlers")

    signals.parcel_status_changed.send(
        sender=object,
        parcel=SimpleNamespace(pk=101),
        old_status="PENDING",
        new_status="RECEIVED",
    )
    signals.waybill_shipped.send(sender=object, waybill=SimpleNamespace(pk=202))
    signals.purchase_order_created.send(sender=object, order=SimpleNamespace(pk=303))
    signals.payment_confirmed.send(sender=object, receivable=SimpleNamespace(pk=404))
    signals.member_registered.send(sender=object, user=SimpleNamespace(pk=505, email="member@example.com"))

    messages = [record.getMessage() for record in caplog.records]
    assert "Parcel 101 status changed: PENDING -> RECEIVED" in messages
    assert "Waybill 202 marked as shipped" in messages
    assert "Purchase order 303 created" in messages
    assert "Payment confirmed for receivable 404" in messages
    assert "New member registered: id=505" in messages
