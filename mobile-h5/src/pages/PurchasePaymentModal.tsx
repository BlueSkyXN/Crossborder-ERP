import type { Wallet, WalletTransaction } from "../features/waybills/types";
import type { PurchaseOrder } from "../features/purchases/types";
import styles from "./PurchaseMobile.module.css";

function formatMoney(value?: string | null, currency = "CNY") {
  return `${currency} ${value || "0.00"}`;
}

function compareMoney(left: string, right: string) {
  return Number(left || 0) - Number(right || 0);
}

type PurchasePaymentModalProps = {
  order: PurchaseOrder;
  wallet: Wallet | undefined;
  transactions: WalletTransaction[];
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function PurchasePaymentModal({
  order,
  wallet,
  transactions,
  isPending,
  onClose,
  onConfirm,
}: PurchasePaymentModalProps) {
  const canPay = wallet ? compareMoney(wallet.balance, order.total_amount) >= 0 : false;

  return (
    <div className={styles.modalOverlay} role="presentation">
      <div className={styles.paymentModal} role="dialog" aria-modal="true" aria-labelledby="mobile-purchase-pay-title">
        <header>
          <span>代购余额支付</span>
          <h2 id="mobile-purchase-pay-title">{order.order_no}</h2>
        </header>
        <dl className={styles.paymentSummary}>
          <div>
            <dt>应付金额</dt>
            <dd>{formatMoney(order.total_amount)}</dd>
          </div>
          <div>
            <dt>当前余额</dt>
            <dd>{formatMoney(wallet?.balance || "0.00", wallet?.currency || "CNY")}</dd>
          </div>
        </dl>
        {!canPay && <div className={styles.warning}>余额不足，请等待后台充值后再支付。</div>}
        <div className={styles.walletHistory}>
          <h3>最近流水</h3>
          {transactions.length === 0 ? (
            <p>暂无钱包流水</p>
          ) : (
            transactions.slice(0, 3).map((transaction) => (
              <div key={transaction.id}>
                <span>{transaction.type}</span>
                <strong>
                  {transaction.direction === "INCREASE" ? "+" : "-"}
                  {transaction.amount}
                </strong>
              </div>
            ))
          )}
        </div>
        <div className={styles.modalActions}>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="button" disabled={!canPay || isPending} onClick={onConfirm}>
            {isPending ? "支付中" : "确认支付"}
          </button>
        </div>
      </div>
    </div>
  );
}
