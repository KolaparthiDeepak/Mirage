"use client";
import { useState } from "react";
import { Button, Input, Modal } from "@/app/_ui";
import { getAdminToken, setAdminToken } from "@/app/_lib/admin-token";

export function AdminTokenModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState(() => getAdminToken());

  function save() {
    setAdminToken(value.trim());
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Admin token">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <p>
          Required to create, edit or delete mocks from this browser (plan 03&apos;s stopgap
          until real accounts exist — see plan 14). Ask whoever set{" "}
          <code>MIRAGE_ADMIN_TOKEN</code> on the server for the value. Stored only in this
          browser&apos;s local storage.
        </p>
        <Input
          type="password"
          aria-label="Admin token"
          placeholder="Paste your admin token"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button variant="primary" onClick={save}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
