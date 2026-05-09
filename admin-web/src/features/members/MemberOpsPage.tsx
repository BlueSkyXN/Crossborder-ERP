import {
  LockOutlined,
  ReloadOutlined,
  SearchOutlined,
  UnlockOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { ForbiddenPage } from "../../pages/ForbiddenPage";
import { memberOpsApi } from "./api";
import type { MemberQuery, MemberStatus, MemberUpdatePayload, MemberUser, ServiceAdminUser } from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
};

type MemberFormValues = {
  display_name: string;
  phone: string;
  level: string;
  assigned_admin_id?: number;
  service_note?: string;
};

type ResetFormValues = {
  password?: string;
};

const membersQueryKey = ["admin-members"] as const;
const serviceAdminsQueryKey = ["admin-member-service-admins"] as const;

const statusMeta: Record<MemberStatus, { color: string; label: string }> = {
  ACTIVE: { color: "green", label: "启用" },
  FROZEN: { color: "red", label: "冻结" },
};

const levelOptions = [
  { label: "basic", value: "basic" },
  { label: "vip", value: "vip" },
  { label: "enterprise", value: "enterprise" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function statusTag(status: MemberStatus) {
  const meta = statusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function serviceAdminOptions(admins: ServiceAdminUser[]) {
  return admins.map((admin) => ({
    label: `${admin.name} · ${admin.email}`,
    value: admin.id,
  }));
}

export function MemberOpsPage() {
  const { allowedCodes } = useOutletContext<WorkspaceContext>();
  const hasPermission = allowedCodes.has("members.view");
  const queryClient = useQueryClient();
  const { message, modal } = AntdApp.useApp();
  const [form] = Form.useForm<MemberFormValues>();
  const [resetForm] = Form.useForm<ResetFormValues>();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<MemberStatus | "ALL">("ALL");
  const [level, setLevel] = useState<string>("ALL");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [resetTarget, setResetTarget] = useState<MemberUser | null>(null);

  const memberQueryParams = useMemo<MemberQuery>(
    () => ({
      keyword,
      status: status === "ALL" ? undefined : status,
      level: level === "ALL" ? undefined : level,
    }),
    [keyword, level, status],
  );

  const membersQuery = useQuery({
    queryKey: [...membersQueryKey, memberQueryParams],
    queryFn: () => memberOpsApi.listMembers(memberQueryParams),
    enabled: hasPermission,
  });
  const serviceAdminsQuery = useQuery({
    queryKey: serviceAdminsQueryKey,
    queryFn: memberOpsApi.listServiceAdmins,
    enabled: hasPermission,
  });

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const serviceAdmins = useMemo(() => serviceAdminsQuery.data ?? [], [serviceAdminsQuery.data]);
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;
  const activeMembers = members.filter((member) => member.status === "ACTIVE").length;
  const frozenMembers = members.filter((member) => member.status === "FROZEN").length;
  const openTickets = members.reduce((total, member) => total + member.service_summary.open_ticket_count, 0);

  useEffect(() => {
    if (selectedMember) {
      form.setFieldsValue({
        display_name: selectedMember.profile.display_name,
        phone: selectedMember.phone,
        level: selectedMember.profile.level,
        assigned_admin_id: selectedMember.profile.assigned_admin_id ?? undefined,
        service_note: selectedMember.profile.service_note,
      });
    }
  }, [form, selectedMember]);

  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: membersQueryKey });

  const updateMutation = useMutation({
    mutationFn: ({ memberId, values }: { memberId: number; values: MemberFormValues }) => {
      const payload: MemberUpdatePayload = {
        display_name: values.display_name.trim(),
        phone: values.phone.trim(),
        level: values.level.trim(),
        assigned_admin_id: values.assigned_admin_id ?? null,
        service_note: values.service_note?.trim() || "",
      };
      return memberOpsApi.updateMember(memberId, payload);
    },
    onSuccess: (member) => {
      message.success("会员资料已更新");
      setSelectedMemberId(member.id);
      invalidateMembers();
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const freezeMutation = useMutation({
    mutationFn: memberOpsApi.freezeMember,
    onSuccess: () => {
      message.success("会员已冻结");
      invalidateMembers();
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const unfreezeMutation = useMutation({
    mutationFn: memberOpsApi.unfreezeMember,
    onSuccess: () => {
      message.success("会员已解冻");
      invalidateMembers();
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const resetMutation = useMutation({
    mutationFn: ({ memberId, values }: { memberId: number; values: ResetFormValues }) =>
      memberOpsApi.resetPassword(memberId, { password: values.password?.trim() || undefined }),
    onSuccess: () => {
      message.success("测试密码已重置");
      setResetTarget(null);
      resetForm.resetFields();
      invalidateMembers();
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  if (!hasPermission) {
    return <ForbiddenPage />;
  }

  const actionLoading = freezeMutation.isPending || unfreezeMutation.isPending;
  const columns: TableColumnsType<MemberUser> = [
    {
      title: "会员",
      dataIndex: "email",
      width: 260,
      render: (value, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong copyable>
            {value}
          </Typography.Text>
          <Typography.Text type="secondary">
            {record.profile.member_no} · {record.profile.display_name || "未命名"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 96,
      render: statusTag,
    },
    {
      title: "等级",
      dataIndex: ["profile", "level"],
      width: 110,
      render: (value) => <Tag color={value === "basic" ? "default" : "blue"}>{value}</Tag>,
    },
    {
      title: "仓库识别码",
      dataIndex: ["profile", "warehouse_code"],
      width: 144,
      render: (value) => <Typography.Text copyable>{value}</Typography.Text>,
    },
    {
      title: "服务信息",
      width: 210,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>{record.profile.assigned_admin_name || "未分配"}</Typography.Text>
          <Typography.Text type="secondary">
            工单 {record.service_summary.open_ticket_count}/{record.service_summary.ticket_count}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "最近登录",
      dataIndex: "last_login_at",
      width: 168,
      render: formatDate,
    },
    {
      title: "注册时间",
      dataIndex: "created_at",
      width: 168,
      render: formatDate,
    },
    {
      title: "操作",
      width: 258,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<UserSwitchOutlined />} onClick={() => setSelectedMemberId(record.id)}>
            详情
          </Button>
          {record.status === "ACTIVE" ? (
            <Button
              size="small"
              danger
              icon={<LockOutlined />}
              loading={actionLoading}
              onClick={() =>
                modal.confirm({
                  title: "冻结会员",
                  content: `冻结后 ${record.email} 的现有用户 token 也不能继续访问私有接口。`,
                  okText: "冻结",
                  okButtonProps: { danger: true },
                  onOk: () => freezeMutation.mutate(record.id),
                })
              }
            >
              冻结
            </Button>
          ) : (
            <Button
              size="small"
              icon={<UnlockOutlined />}
              loading={actionLoading}
              onClick={() => unfreezeMutation.mutate(record.id)}
            >
              解冻
            </Button>
          )}
          <Button size="small" onClick={() => setResetTarget(record)}>
            重置密码
          </Button>
        </Space>
      ),
    },
  ];

  const submitUpdate = (values: MemberFormValues) => {
    if (!selectedMember) {
      return;
    }
    updateMutation.mutate({ memberId: selectedMember.id, values });
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="当前会员" value={members.length} suffix={`/${activeMembers} 启用`} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="冻结会员"
              value={frozenMembers}
              styles={{ content: { color: frozenMembers ? "#cf1322" : undefined } }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="待处理工单" value={openTickets} />
          </Card>
        </Col>
      </Row>

      <Card
        title="会员管理"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => membersQuery.refetch()} loading={membersQuery.isFetching}>
            刷新
          </Button>
        }
      >
        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
          {membersQuery.isError && (
            <Alert type="error" showIcon message={getErrorMessage(membersQuery.error)} />
          )}
          <Row gutter={[12, 12]}>
            <Col xs={24} md={10}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="搜索邮箱、会员号、手机号、仓库识别码"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </Col>
            <Col xs={12} md={5}>
              <Select
                value={status}
                style={{ width: "100%" }}
                onChange={setStatus}
                options={[
                  { label: "全部状态", value: "ALL" },
                  { label: "启用", value: "ACTIVE" },
                  { label: "冻结", value: "FROZEN" },
                ]}
              />
            </Col>
            <Col xs={12} md={5}>
              <Select
                value={level}
                style={{ width: "100%" }}
                onChange={setLevel}
                options={[{ label: "全部等级", value: "ALL" }, ...levelOptions]}
              />
            </Col>
          </Row>
          <Table<MemberUser>
            rowKey="id"
            loading={membersQuery.isLoading}
            columns={columns}
            dataSource={members}
            scroll={{ x: 1380 }}
            locale={{ emptyText: <Empty description="暂无会员" /> }}
            pagination={{ pageSize: 10, showSizeChanger: false }}
          />
        </Space>
      </Card>

      <Drawer
        title={selectedMember ? `会员详情 · ${selectedMember.profile.member_no}` : "会员详情"}
        size="large"
        open={Boolean(selectedMember)}
        onClose={() => setSelectedMemberId(null)}
        destroyOnHidden
      >
        {selectedMember && (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="邮箱">{selectedMember.email}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(selectedMember.status)}</Descriptions.Item>
              <Descriptions.Item label="仓库识别码">{selectedMember.profile.warehouse_code}</Descriptions.Item>
              <Descriptions.Item label="注册时间">{formatDate(selectedMember.created_at)}</Descriptions.Item>
              <Descriptions.Item label="最近登录">{formatDate(selectedMember.last_login_at)}</Descriptions.Item>
              <Descriptions.Item label="工单">
                {selectedMember.service_summary.open_ticket_count}/{selectedMember.service_summary.ticket_count}
                {selectedMember.service_summary.last_ticket_at
                  ? ` · ${formatDate(selectedMember.service_summary.last_ticket_at)}`
                  : ""}
              </Descriptions.Item>
            </Descriptions>

            <Form form={form} layout="vertical" onFinish={submitUpdate}>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item name="display_name" label="会员昵称">
                    <Input maxLength={100} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="phone" label="手机号">
                    <Input maxLength={30} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="level" label="会员等级" rules={[{ required: true, message: "请输入会员等级" }]}>
                    <Select options={levelOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="assigned_admin_id" label="客服负责人">
                    <Select
                      allowClear
                      loading={serviceAdminsQuery.isLoading}
                      options={serviceAdminOptions(serviceAdmins)}
                      placeholder="未分配"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="service_note" label="服务备注">
                <Input.TextArea rows={4} maxLength={500} showCount />
              </Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                  保存资料
                </Button>
                <Button onClick={() => form.resetFields()}>重置表单</Button>
              </Space>
            </Form>
          </Space>
        )}
      </Drawer>

      <Modal
        title="重置测试密码"
        open={Boolean(resetTarget)}
        okText="确认重置"
        confirmLoading={resetMutation.isPending}
        onCancel={() => {
          setResetTarget(null);
          resetForm.resetFields();
        }}
        onOk={() => resetForm.submit()}
      >
        {resetTarget && (
          <Form
            form={resetForm}
            layout="vertical"
            initialValues={{ password: "password123" }}
            onFinish={(values) => resetMutation.mutate({ memberId: resetTarget.id, values })}
          >
            <Alert
              type="warning"
              showIcon
              message={`将重置 ${resetTarget.email} 的测试登录密码。`}
              style={{ marginBottom: 16 }}
            />
            <Form.Item
              name="password"
              label="新密码"
              rules={[{ min: 8, message: "密码至少 8 位" }]}
            >
              <Input.Password placeholder="默认 password123" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </Space>
  );
}
