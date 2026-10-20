import { useRef, useState } from "react";
import {
  type Data,
  type Transaction,
  money,
  shortDate,
  voidTransaction,
} from "../model";
import { Modal, Button } from "./UI";
import { FormError, type Commit } from "./Forms";

const moneyEntryName = (t: Transaction) =>
  ({
    income: "Income recorded",
    payday: "Payday savings",
    deposit: "Savings added",
    withdrawal: "Savings removed",
    purchase: "Purchase",
    opening: "Starting balance",
  })[t.kind];
const moneyEntryAmount = (t: Transaction) =>
  t.gross ?? Math.abs(t.entries.reduce((total, e) => total + e.amount, 0));

export function UndoMoney({
  data,
  transactionId,
  commit,
  onClose,
}: {
  data: Data;
  transactionId: string;
  commit: Commit;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const saving = useRef(false);
  const t = data.transactions.find((t) => t.id === transactionId);
  let previewError = "";
  try {
    voidTransaction(data, transactionId);
  } catch (e) {
    previewError = (e as Error).message;
  }
  const changes = new Map<string, number>();
  t?.entries.forEach((e) =>
    changes.set(e.goalId, (changes.get(e.goalId) || 0) - e.amount),
  );
  function undo() {
    if (saving.current || previewError) return;
    saving.current = true;
    try {
      if (commit(voidTransaction(data, transactionId), "Money entry undone"))
        onClose();
      else {
        saving.current = false;
        setError(
          "Could not save the undo. Reopen this screen to use the latest plan.",
        );
      }
    } catch (e) {
      saving.current = false;
      setError((e as Error).message);
    }
  }
  return (
    <Modal title="Undo this money entry?" onClose={onClose}>
      {t ? (
        <>
          <div className="undo-summary">
            <span>
              {moneyEntryName(t)} · {shortDate(t.date, true)}
            </span>
            <strong>
              {money(moneyEntryAmount(t), data.settings.currency, true)}
            </strong>
            {t.note && t.note !== moneyEntryName(t) ? (
              <small>{t.note}</small>
            ) : null}
          </div>
          {changes.size ? (
            <div className="detail-list">
              {[...changes].map(([id, amount]) => (
                <div key={id}>
                  <span>
                    {data.goals.find((g) => g.id === id)?.name ||
                      "Archived goal"}
                  </span>
                  <strong>
                    {amount < 0 ? "−" : "+"}
                    {money(Math.abs(amount), data.settings.currency)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="fine-print">
              This entry did not add money to a goal.
            </p>
          )}
          {t.gross !== undefined ? (
            <p className="fine-print">
              Also reverses the recorded income allocations:{" "}
              {[
                ["tithing", t.giving || 0],
                ["spending", t.spending || 0],
                ["expenses", t.expenses || 0],
              ]
                .filter(([, amount]) => Number(amount) > 0)
                .map(
                  ([name, amount]) =>
                    `${money(Number(amount), data.settings.currency)} ${name}`,
                )
                .join(" · ") || "none"}
              .
            </p>
          ) : null}
          <p className="fine-print">
            The entire entry is reversed across all affected goals. It stays in
            your history marked Undone.
          </p>
        </>
      ) : null}
      <FormError error={error || previewError} />
      <div className="button-stack">
        <Button disabled={Boolean(previewError)} onClick={undo}>
          Undo entry
        </Button>
        <Button secondary onClick={onClose}>
          Keep entry
        </Button>
      </div>
    </Modal>
  );
}
