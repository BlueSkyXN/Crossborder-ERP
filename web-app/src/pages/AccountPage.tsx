import { useCallback, useEffect, useState } from "react";
import { Button, Card, Descriptions, Form, Input, Modal, Space, Spin, Tag, Typography, message } from "antd";
import { memberAuth } from "@crossborder-erp/api-client";
import type { Member } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title } = Typography;

type ProfileForm = {
  display_name?: string;
  phone?: string;
};

type PasswordForm = {
  current_password: string;
  new_password: string;
};

export function AccountPage() {
  const [user, setUser] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [profileForm] = Form.useForm<ProfileForm>();
  const [passwordForm] = Form.useForm<PasswordForm>();

  const load = useCallback(() => {
    setLoading(true);
    memberAuth.getMe(memberClient)
      .then(setUser)
      .catch(() => message.error("账号信息加载失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const saveProfile = async (values: ProfileForm) => {
    try {
      await memberAuth.updateProfile(memberClient, { ...values });
      message.success("资料已更新");
      setEditing(false);
      load();
    } catch {
      message.error("资料更新失败");
    }
  };

  const changePassword = async (values: PasswordForm) => {
    try {
      await memberAuth.changePassword(memberClient, { ...values });
      message.success("密码已更新");
      passwordForm.resetFields();
    } catch {
      message.error("密码更新失败");
    }
  };

  if (loading) {
    return <Spin size="large" style={{ display: "block", margin: "120px auto" }} />;
  }
  if (!user) return null;

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Card
        style={{ borderRadius: "var(--radius-card)" }}
        extra={(
          <Button
            onClick={() => {
              profileForm.setFieldsValue({
                display_name: user.profile.display_name,
                phone: user.phone ?? undefined,
              });
              setEditing(true);
            }}
          >
            编辑资料
          </Button>
        )}
      >
        <Title level={4}>个人中心</Title>
        <Descriptions
          bordered
          column={2}
          items={[
            { key: "email", label: "邮箱", children: user.email },
            { key: "phone", label: "手机", children: user.phone ?? "-" },
            { key: "status", label: "状态", children: <Tag>{user.status}</Tag> },
            {
              key: "member_no",
              label: "会员编号",
              children: <Tag color="gold">{user.profile.member_no}</Tag>,
            },
            { key: "display", label: "显示名称", children: user.profile.display_name ?? "-" },
            { key: "level", label: "会员等级", children: user.profile.level ?? "-" },
            { key: "warehouse", label: "仓库识别码", children: user.profile.warehouse_code ?? "-" },
          ]}
        />
      </Card>
      <Card title="修改密码" style={{ borderRadius: "var(--radius-card)" }}>
        <Form form={passwordForm} layout="vertical" onFinish={changePassword}>
          <Form.Item name="current_password" label="当前密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[{ required: true, min: 8, message: "新密码至少 8 位" }]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            修改密码
          </Button>
        </Form>
      </Card>
      <Modal open={editing} title="编辑个人资料" onCancel={() => setEditing(false)} footer={null}>
        <Form form={profileForm} layout="vertical" onFinish={saveProfile}>
          <Form.Item name="display_name" label="显示名称">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
        </Form>
      </Modal>
    </Space>
  );
}
