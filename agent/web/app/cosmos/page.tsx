import { redirect } from "next/navigation";

/** Legacy COSMOS route — unified app lives at / with the main DELPHI engine. */
export default function CosmosPage() {
  redirect("/?tab=moment");
}
