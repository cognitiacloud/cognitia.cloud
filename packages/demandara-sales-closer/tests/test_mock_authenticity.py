import unittest

from demandara_sales_closer.mock_authenticity import (
    CLAIM_SAFE_SUCCESSOR_LINE,
    LocalMockApprovalError,
    LocalMockSigner,
    MockApprovalSigner,
    canonical_local_mock_payload,
    create_local_mock_approval_receipt,
    local_mock_canonical_payload_hash,
    verify_local_mock_approval_receipt,
)

PAYLOAD = {
    "tenant_id": "budget_wheels_demo",
    "lead_id": "bw-demo-001",
    "reviewer_id": "demo-human-operator",
    "approval_decision": "APPROVED",
    "nonce": "local-mock-nonce-001",
    "timestamp": "2026-06-27T00:00:00Z",
}


class LocalMockAuthenticityScaffoldingTests(unittest.TestCase):
    def test_valid_local_mock_receipt_passes(self):
        receipt = create_local_mock_approval_receipt(PAYLOAD)
        self.assertTrue(verify_local_mock_approval_receipt(PAYLOAD, receipt))
        self.assertTrue(receipt["local_mock_only"])

    def test_caller_supplied_forged_proof_string_fails(self):
        signer = LocalMockSigner()
        with self.assertRaises(LocalMockApprovalError):
            signer.verify_local_mock_receipt(PAYLOAD, {"mock_signature": "proof-forged-caller-supplied"})

    def test_tampered_payload_fails(self):
        signer = LocalMockSigner()
        receipt = signer.create_local_mock_receipt(PAYLOAD).to_dict()
        tampered = {**PAYLOAD, "lead_id": "bw-demo-999"}
        with self.assertRaisesRegex(LocalMockApprovalError, "does not match canonical payload"):
            signer.verify_local_mock_receipt(tampered, receipt)

    def test_wrong_tenant_or_lead_fails(self):
        signer = LocalMockSigner()
        receipt = signer.create_local_mock_receipt(PAYLOAD).to_dict()
        wrong_tenant = {**PAYLOAD, "tenant_id": "other_tenant"}
        wrong_lead = {**PAYLOAD, "lead_id": "other-lead"}
        with self.assertRaises(LocalMockApprovalError):
            signer.verify_local_mock_receipt(wrong_tenant, receipt)
        with self.assertRaises(LocalMockApprovalError):
            signer.verify_local_mock_receipt(wrong_lead, receipt)

    def test_missing_reviewer_id_fails(self):
        missing = dict(PAYLOAD)
        missing.pop("reviewer_id")
        with self.assertRaisesRegex(LocalMockApprovalError, "reviewer_id"):
            canonical_local_mock_payload(missing)

    def test_missing_nonce_fails(self):
        missing = dict(PAYLOAD)
        missing.pop("nonce")
        with self.assertRaisesRegex(LocalMockApprovalError, "nonce"):
            create_local_mock_approval_receipt(missing)

    def test_non_mock_signature_field_fails(self):
        signer = LocalMockSigner()
        receipt = signer.create_local_mock_receipt(PAYLOAD).to_dict()
        receipt["mock_signature"] = "real-looking-signature-value"
        with self.assertRaisesRegex(LocalMockApprovalError, "LocalMockSigner"):
            signer.verify_local_mock_receipt(PAYLOAD, receipt)

    def test_receipt_without_local_mock_only_flag_fails(self):
        signer = LocalMockSigner()
        receipt = signer.create_local_mock_receipt(PAYLOAD).to_dict()
        receipt["local_mock_only"] = False
        with self.assertRaisesRegex(LocalMockApprovalError, "local_mock_only"):
            signer.verify_local_mock_receipt(PAYLOAD, receipt)

    def test_missing_local_mock_only_field_fails(self):
        receipt = create_local_mock_approval_receipt(PAYLOAD)
        del receipt["local_mock_only"]
        with self.assertRaisesRegex(LocalMockApprovalError, "local_mock_only"):
            verify_local_mock_approval_receipt(PAYLOAD, receipt)

    def test_output_contains_not_real_signature_and_authenticity_disclaimers(self):
        receipt = create_local_mock_approval_receipt(PAYLOAD)
        self.assertTrue(receipt["not_real_signature"])
        self.assertTrue(receipt["not_real_approval_authenticity"])
        self.assertIn("not-a-real-signature", receipt["mock_signature"])
        self.assertIn("not-real", receipt["mock_key_id_or_version"])
        self.assertIn("not execution authorizations", CLAIM_SAFE_SUCCESSOR_LINE)

    def test_deterministic_canonical_hash_is_stable_across_reruns(self):
        first = local_mock_canonical_payload_hash(PAYLOAD)
        second = local_mock_canonical_payload_hash(dict(reversed(list(PAYLOAD.items()))))
        self.assertEqual(first, second)
        self.assertEqual(
            create_local_mock_approval_receipt(PAYLOAD),
            create_local_mock_approval_receipt(PAYLOAD),
        )

    def test_invalid_decision_fails(self):
        invalid = {**PAYLOAD, "approval_decision": "MAYBE"}
        with self.assertRaisesRegex(LocalMockApprovalError, "invalid"):
            create_local_mock_approval_receipt(invalid)

    def test_mock_approval_signer_alias_still_mock_only(self):
        receipt = MockApprovalSigner().create_local_mock_receipt(PAYLOAD).to_dict()
        self.assertTrue(receipt["local_mock_only"])
        self.assertTrue(receipt["not_real_signature"])
        self.assertTrue(receipt["not_real_approval_authenticity"])


if __name__ == "__main__":
    unittest.main()
