import { Button, Result } from "antd";
import { useNavigate } from "react-router-dom";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="404"
      subTitle="页面不存在或已经移动。"
      extra={
        <Button type="primary" onClick={() => navigate("/dashboard")}>
          返回控制台
        </Button>
      }
    />
  );
}
