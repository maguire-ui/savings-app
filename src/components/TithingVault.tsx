import { useRef, useState } from "react";
import {
  type Data,
  tithingBalance,
  depositTithing,
  undoTithingDeposit,
  money,
  shortDate,
} from "../model";
import { Modal, Button } from "./UI";
import { FormError, type Commit } from "./Forms";

export function TithingVault({ data, commit, onClose }: {
  data: Data;
  commit: Commit;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const saving = useRef(false);
  const balance = tithingBalance(data);
  const history = [...(data.tithingDeposits || [])].reverse();
  const lastDeposit = history.find((p) => !p.voided);

  function save(next: () => Data, message: string) {
    if (saving.current) return;
    saving.current = true;
    try {
      if (commit(next(), message)) onClose();
      else {
        saving.current = false;
        setError("Could not save. Reopen the vault and try again.");
      }
    } catch (e) {
      saving.current = false;
      setError((e as Error).message);
    }
  }

  return (
    <Modal title="Tithing vault" onClose={onClose}>
      <div className="vault-balance">
        {money(balance, data.settings.currency, true)}
      </div>
      <p className="muted">Waiting to be paid</p>
      <p className="fine-print">
        New income adds tithing here. After you pay it, tap Deposited.
        This only updates your tracker.
      </p>
      {history.length ? (
        <div className="detail-list">
          {history.slice(0, 5).map((p) => (
            <div key={p.id}>
              <span>{shortDate(p.date, true)} · {p.voided ? "Undone" : "Deposited"}</span>
              <strong>{money(p.amount, data.settings.currency, true)}</strong>
            </div>
          ))}
        </div>
      ) : null}
      <FormError error={error} />
      <Button
        disabled={balance === 0}
        onClick={() => save(() => depositTithing(data), "Tithing marked deposited")}
      >
        Deposited
      </Button>
      {lastDeposit ? (
        <button
          className="text-link spaced"
          onClick={() => save(() => undoTithingDeposit(data, lastDeposit.id), "Tithing deposit undone")}
        >
          Undo last deposit
        </button>
      ) : null}
    </Modal>
  );
}
