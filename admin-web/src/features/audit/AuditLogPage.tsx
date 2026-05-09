import { DownloadOutlined, FileSearchOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Descriptions, Drawer, Empty, Input, Select, Space, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { ForbiddenPage } from "../../pages/ForbiddenPage";
import { auditLogsApi } from "./api";
import type { AuditLog, AuditLogQuery } from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
  permissionCodes: Set<string>;
};

const pageSize = 20;

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function methodTag(method: string) {
  const colorByMethod: Record<string, string> = {
    POST: "blue",
    PUT: "purple",
    PATCH: "geekblue",
    DELETE: "red",
  };
  return <Tag color={colorByMethod[method] || "default"}>{method}</Tag>;
}

function statusTag(statusCode: number) {
  const color = statusCode >= 500 ? "red" : statusCode >= 400 ? "orange" : "green";
  return <Tag color={color}>{statusCode}</Tag>;
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value || {}, null, 2);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AuditLogPage() {
  const { allowedCodes, permissionCodes } = useOutletContext<WorkspaceContext>();
  const hasPermission = allowedCodes.has("audit.logs.view");
  const canExport = permissionCodes.has("audit.logs.export");
  const [keyword, setKeyword] = useState("");
  const [method, setMethod] = useState<string | undefined>();
  const [targetType, setTargetType] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const query = useMemo<AuditLogQuery>(
    () => ({
      keyword: keyword.trim(),
      method,
      target_type: targetType,
      page,
      page_size: pageSize,
    }),
    [keyword, method, page, targetType],
  );

  const logsQuery = useQuery({
    queryKey: ["admin-audit-logs", query],
    queryFn: () => auditLogsApi.listLogs(query),
    enabled: hasPermission,
  });
  const exportMutation = useMutation({
    mutationFn: () => auditLogsApi.exportLogs({ keyword: query.keyword, method: query.method, target_type: query.target_type }),
    onSuccess: (blob) => downloadBlob(blob, "audit-logs-export.csv"),
  });

  const logs = useMemo(() => logsQuery.data?.items ?? [], [logsQuery.data]);
  const total = logsQuery.data?.pagination?.total ?? logs.length;
  const targetOptions = useMemo(() => {
    const values = new Set(logs.map((log) => log.target_type).filter(Boolean));
    return Array.from(values).map((value) => ({ label: value, value }));
  }, [logs]);

  if (!hasPermission) {
    return <ForbiddenPage />;
  }

  const columns: TableColumnsType<AuditLog> = [
    {
      title: "时间",
      dataIndex: "created_at",
      width: 180,
      render: (value: string) => formatDate(value),
    },
    {
      title: "操作人",
      dataIndex: "operator_label",
      width: 190,
      render: (value: string, record) => value || record.operator_type,
    },
    {
      title: "动作",
      dataIndex: "action",
      width: 220,
    },
    {
      title: "对象",
      width: 180,
      render: (_, record) => (
        <Space size={4}>
          <Tag>{record.target_type || "-"}</Tag>
          {record.target_id ? <Typography.Text type="secondary">#{record.target_id}</Typography.Text> : null}
        </Space>
      ),
    },
    {
      title: "请求",
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          {methodTag(record.request_method)}
          {statusTag(record.status_code)}
        </Space>
      ),
    },
    {
      title: "路径",
      dataIndex: "request_path",
      ellipsis: true,
    },
    {
      title: "操作",
      width: 100,
      render: (_, record) => (
        <Button type="link" icon={<FileSearchOutlined />} onClick={() => setSelectedLog(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size={16} className="workspace-page">
      <Card>
        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索路径或操作人"
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              style={{ width: 260 }}
            />
            <Select
              allowClear
              placeholder="请求方法"
              value={method}
              options={["POST", "PUT", "PATCH", "DELETE"].map((value) => ({ label: value, value }))}
              onChange={(value) => {
                setMethod(value);
                setPage(1);
              }}
              style={{ width: 140 }}
            />
            <Select
              allowClear
              showSearch
              placeholder="对象类型"
              value={targetType}
              options={targetOptions}
              onChange={(value) => {
                setTargetType(value);
                setPage(1);
              }}
              style={{ width: 180 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => logsQuery.refetch()}>
              刷新
            </Button>
            <Button
              icon={<DownloadOutlined />}
              disabled={!canExport}
              loading={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            >
              导出 CSV
            </Button>
          </Space>
          <Alert
            type="info"
            showIcon
            title={
              canExport
                ? "后台关键写操作会自动进入审计日志，敏感字段会做脱敏处理。"
                : "当前账号只读审计日志，缺少 audit.logs.export。"
            }
          />
        </Space>
      </Card>
      <Card title="操作审计">
        <Table
          rowKey="id"
          loading={logsQuery.isLoading}
          columns={columns}
          dataSource={logs}
          locale={{ emptyText: <Empty description="暂无审计日志" /> }}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: setPage,
            showSizeChanger: false,
          }}
        />
      </Card>
      <Drawer
        size="large"
        title="审计详情"
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
      >
        {selectedLog ? (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="动作">{selectedLog.action}</Descriptions.Item>
              <Descriptions.Item label="操作人">
                {selectedLog.operator_label || selectedLog.operator_type}
              </Descriptions.Item>
              <Descriptions.Item label="对象">
                {selectedLog.target_type || "-"} {selectedLog.target_id ? `#${selectedLog.target_id}` : ""}
              </Descriptions.Item>
              <Descriptions.Item label="请求">
                {selectedLog.request_method} {selectedLog.request_path}
              </Descriptions.Item>
              <Descriptions.Item label="状态">{selectedLog.status_code}</Descriptions.Item>
              <Descriptions.Item label="IP">{selectedLog.ip_address || "-"}</Descriptions.Item>
              <Descriptions.Item label="时间">{formatDate(selectedLog.created_at)}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title="请求数据">
              <pre className="json-preview">{stringifyJson(selectedLog.request_data)}</pre>
            </Card>
            <Card size="small" title="响应数据">
              <pre className="json-preview">{stringifyJson(selectedLog.response_data)}</pre>
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
