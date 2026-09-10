"use client";
import { useRouter } from "next/navigation";
import { Modal } from "@/app/_ui";
import { EndpointForm } from "./EndpointForm";

export function CreateEndpointModal({
  open,
  onClose,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
}) {
  const router = useRouter();

  return (
    <Modal open={open} onClose={onClose} title="New endpoint">
      <EndpointForm
        slug={slug}
        onCreated={(method, path) => {
          onClose();
          router.push(`/p/${slug}/endpoints?e=${encodeURIComponent(`${method} ${path}`)}`);
        }}
      />
    </Modal>
  );
}
