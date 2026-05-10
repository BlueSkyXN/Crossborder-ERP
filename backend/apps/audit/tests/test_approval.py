"""Tests for the approval flow (AUDIT-APPROVAL-001)."""
from __future__ import annotations

from django.contrib.auth.hashers import make_password
from django.test import TestCase
from rest_framework import exceptions

from apps.audit.models import ApprovalRequest, ApprovalStatus
from apps.audit.services import (
    HIGH_RISK_ACTIONS,
    approve_request,
    create_approval_request,
    is_high_risk_action,
    list_approval_requests,
    reject_request,
)
from apps.iam.models import AdminUser, AdminUserStatus


class ApprovalFlowTests(TestCase):
    def setUp(self):
        self.admin1 = AdminUser.objects.create(
            email="requester@test.com",
            name="Requester",
            password_hash=make_password("TestPass123"),
            status=AdminUserStatus.ACTIVE,
        )
        self.admin2 = AdminUser.objects.create(
            email="approver@test.com",
            name="Approver",
            password_hash=make_password("TestPass123"),
            status=AdminUserStatus.ACTIVE,
        )

    def test_create_approval_request(self):
        req = create_approval_request(
            action="finance.large_refund",
            target_type="payment_order",
            target_id="123",
            requester=self.admin1,
            payload={"amount": "5000.00"},
            reason="Customer refund",
        )
        self.assertEqual(req.status, ApprovalStatus.PENDING)
        self.assertEqual(req.requester_id, self.admin1.id)
        self.assertEqual(req.action, "finance.large_refund")

    def test_approve_request(self):
        req = create_approval_request(
            action="finance.large_refund",
            target_type="payment_order",
            requester=self.admin1,
        )
        approved = approve_request(approval=req, approver=self.admin2, decision_note="OK")
        self.assertEqual(approved.status, ApprovalStatus.APPROVED)
        self.assertEqual(approved.approver_id, self.admin2.id)
        self.assertIsNotNone(approved.decided_at)

    def test_reject_request(self):
        req = create_approval_request(
            action="iam.role_escalation",
            target_type="admin_user",
            requester=self.admin1,
        )
        rejected = reject_request(approval=req, approver=self.admin2, decision_note="Not needed")
        self.assertEqual(rejected.status, ApprovalStatus.REJECTED)

    def test_cannot_approve_own_request(self):
        req = create_approval_request(
            action="finance.large_refund",
            target_type="payment_order",
            requester=self.admin1,
        )
        with self.assertRaises(exceptions.PermissionDenied):
            approve_request(approval=req, approver=self.admin1)

    def test_cannot_approve_non_pending(self):
        req = create_approval_request(
            action="finance.large_refund",
            target_type="payment_order",
            requester=self.admin1,
        )
        approve_request(approval=req, approver=self.admin2)
        with self.assertRaises(exceptions.ValidationError):
            approve_request(approval=req, approver=self.admin2)

    def test_cannot_reject_non_pending(self):
        req = create_approval_request(
            action="finance.large_refund",
            target_type="payment_order",
            requester=self.admin1,
        )
        reject_request(approval=req, approver=self.admin2)
        with self.assertRaises(exceptions.ValidationError):
            reject_request(approval=req, approver=self.admin2)

    def test_list_approval_requests(self):
        create_approval_request(action="a", target_type="x", requester=self.admin1)
        create_approval_request(action="b", target_type="y", requester=self.admin1)
        self.assertEqual(list_approval_requests().count(), 2)
        self.assertEqual(list_approval_requests(status="PENDING").count(), 2)

    def test_is_high_risk_action(self):
        self.assertTrue(is_high_risk_action("finance.large_refund"))
        self.assertTrue(is_high_risk_action("iam.role_escalation"))
        self.assertFalse(is_high_risk_action("content.publish"))
