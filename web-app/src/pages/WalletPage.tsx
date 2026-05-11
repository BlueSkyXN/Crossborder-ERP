import { useEffect, useState } from "react";
import { Button, Card, Col, Row, Statistic, Table, Tag, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { memberFinance } from "@crossborder-erp/api-client";
import type { PaginatedResponse, WalletInfo, WalletTransaction } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title } = Typography;

export function WalletPage() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [txs, setTxs] = useState<PaginatedResponse<WalletTransaction>>({
    items: [],
    pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    memberFinance.getWallet(memberClient)
      .then(setWallet)
      .catch(() => message.error("钱包信息加载失败"));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setLoading(true);
      memberFinance.getTransactions(memberClient, { page })
        .then(setTxs)
        .catch(() => message.error("交易流水加载失败"))
        .finally(() => setLoading(false));
    });
  }, [page]);

  return (
    <div>
      <Title level={4}>财务中心</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card style={{ borderRadius: "var(--radius-card)" }}>
            <Statistic
              title={`可用余额（${wallet?.currency ?? "-"}）`}
              value={wallet?.balance ?? 0}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card style={{ borderRadius: "var(--radius-card)" }}>
            <Statistic
              title={`冻结余额（${wallet?.currency ?? "-"}）`}
              value={wallet?.frozen_balance ?? 0}
              precision={2}
            />
          </Card>
        </Col>
      </Row>
      <Card
        title="交易流水"
        style={{ borderRadius: "var(--radius-card)" }}
        extra={(
          <Button type="primary" onClick={() => navigate("/remittances/new")}>
            提交线下汇款
          </Button>
        )}
      >
        <Table<WalletTransaction>
          rowKey="id"
          loading={loading}
          dataSource={txs.items}
          pagination={{
            current: txs.pagination.page,
            pageSize: txs.pagination.page_size,
            total: txs.pagination.total,
            onChange: (nextPage) => {
              setLoading(true);
              setPage(nextPage);
            },
          }}
          columns={[
            { title: "类型", dataIndex: "type" },
            {
              title: "方向",
              dataIndex: "direction",
              render: (direction: string) => (
                <Tag color={direction === "IN" ? "green" : "red"}>{direction}</Tag>
              ),
            },
            { title: "金额", dataIndex: "amount" },
            { title: "余额", dataIndex: "balance_after" },
            { title: "业务类型", dataIndex: "business_type" },
            { title: "备注", dataIndex: "remark" },
            { title: "创建时间", dataIndex: "created_at" },
          ]}
        />
      </Card>
    </div>
  );
}
