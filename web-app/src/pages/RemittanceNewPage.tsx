import { useState } from "react";
import { Button, Card, Form, Input, InputNumber, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { memberFinance } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title, Paragraph } = Typography;

type RemittanceForm = {
  amount: number;
  currency: string;
  proof_file_id?: string;
  remark?: string;
};

export function RemittanceNewPage() {
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: RemittanceForm) => {
    setSubmitting(true);
    try {
      await memberFinance.submitRemittance(memberClient, { ...values });
      message.success("线下汇款提交成功");
      navigate("/wallet");
    } catch {
      message.error("提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card style={{ borderRadius: "var(--radius-card)" }}>
      <Title level={4}>提交线下汇款</Title>
      <Paragraph type="secondary">请完成银行转账后提交凭证编号，客服审核后入账。</Paragraph>
      <Form layout="vertical" onFinish={onFinish} initialValues={{ currency: "CNY" }}>
        <Form.Item
          name="amount"
          label="汇款金额"
          rules={[{ required: true, message: "请输入金额" }]}
        >
          <InputNumber min={0.01} precision={2} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="proof_file_id"
          label="汇款凭证文件ID"
          rules={[{ required: true, message: "请输入汇款凭证文件ID" }]}
        >
          <Input placeholder="文件上传功能后续接入，当前可填写凭证ID" />
        </Form.Item>
        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={4} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting}>
          提交汇款
        </Button>
      </Form>
    </Card>
  );
}
