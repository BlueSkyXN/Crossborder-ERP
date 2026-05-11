import { Typography } from "antd";

const { Title, Paragraph } = Typography;

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <Title level={3} style={{ color: "#999" }}>{title}</Title>
      <Paragraph style={{ color: "#bbb" }}>
        {description || "此页面正在开发中，敬请期待。"}
      </Paragraph>
    </div>
  );
}
