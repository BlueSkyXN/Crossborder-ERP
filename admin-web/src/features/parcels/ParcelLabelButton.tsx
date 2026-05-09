import { PrinterOutlined } from "@ant-design/icons";
import { Button, Descriptions, Modal, Space, Typography } from "antd";
import { useCallback, useRef, useState } from "react";

interface ParcelLabelData {
  parcel_no: string;
  tracking_no: string;
  user_email: string;
  warehouse_name: string;
  weight_kg: string | null;
  length_cm: string | null;
  width_cm: string | null;
  height_cm: string | null;
  carrier?: string;
  inbound_at?: string | null;
}

function formatWeight(kg: string | null) {
  if (!kg) return "-";
  return `${parseFloat(kg).toFixed(2)} kg`;
}

function formatDimensions(p: ParcelLabelData) {
  if (!p.length_cm || !p.width_cm || !p.height_cm) return "-";
  return `${p.length_cm} × ${p.width_cm} × ${p.height_cm} cm`;
}

function LabelContent({ parcel }: { parcel: ParcelLabelData }) {
  return (
    <div
      style={{
        padding: 24,
        border: "2px solid #000",
        fontFamily: "monospace",
        width: 400,
        background: "#fff",
      }}
    >
      <Typography.Title level={4} style={{ textAlign: "center", margin: "0 0 12px" }}>
        包裹标签
      </Typography.Title>
      <Descriptions
        column={1}
        size="small"
        bordered
        items={[
          { key: "pno", label: "包裹号", children: <strong>{parcel.parcel_no}</strong> },
          { key: "tno", label: "快递单号", children: parcel.tracking_no },
          { key: "member", label: "会员", children: parcel.user_email },
          { key: "wh", label: "仓库", children: parcel.warehouse_name },
          { key: "carrier", label: "承运商", children: parcel.carrier || "-" },
          { key: "weight", label: "重量", children: formatWeight(parcel.weight_kg) },
          { key: "dim", label: "尺寸", children: formatDimensions(parcel) },
        ]}
      />
      <Typography.Text type="secondary" style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 10 }}>
        {parcel.inbound_at ? new Date(parcel.inbound_at).toLocaleString("zh-CN") : ""}
      </Typography.Text>
    </div>
  );
}

export function ParcelLabelButton({ parcel }: { parcel: ParcelLabelData }) {
  const [visible, setVisible] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank", "width=500,height=600");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>包裹标签 - ${parcel.parcel_no}</title>
      <style>body{margin:0;padding:20px;font-family:monospace}
      .ant-descriptions-bordered .ant-descriptions-item-label{font-weight:600}
      </style></head><body>
      ${printRef.current.innerHTML}
      <script>window.onload=function(){window.print();window.close()}</script>
      </body></html>
    `);
    printWindow.document.close();
  }, [parcel.parcel_no]);

  return (
    <>
      <Button size="small" icon={<PrinterOutlined />} onClick={() => setVisible(true)}>
        标签
      </Button>
      <Modal
        title="包裹标签预览"
        open={visible}
        onCancel={() => setVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setVisible(false)}>关闭</Button>
            <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
              打印
            </Button>
          </Space>
        }
        width={480}
      >
        <div ref={printRef}>
          <LabelContent parcel={parcel} />
        </div>
      </Modal>
    </>
  );
}
