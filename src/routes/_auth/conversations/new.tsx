import { createFileRoute, useNavigate } from "@tanstack/react-router";
import useBoundStore from "@/stores/useBoundStore";
import {
  Search,
  X,
  MessageSquarePlus,
  MessageCircle,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { startConversation } from "@/utils/ConversationUtils";
import { useState, useEffect, useRef } from "react";
import { formatPhoneNumber } from "@/utils/FormatUtils";
import SectionHeader from "@/components/SectionHeader";
import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";
import SectionItem from "@/components/SectionItem";
import SectionBody from "@/components/SectionBody";
import Spinner from "@/components/Spinner";
import { supabase } from "@/supabase/client";

export const Route = createFileRoute("/_auth/conversations/new")({
  component: NewChat,
});

type ValidationStatus = "idle" | "checking" | "valid" | "unverified";

function NewChat() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { data: addresses } = useOrganizationsAddresses();
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);

  const localAddress = addresses?.find(
    (address) => address.service === "local",
  );

  const whatsappAddresses = addresses?.filter(
    (address) => address.service === "whatsapp",
  );
  const whatsappAddress = whatsappAddresses?.[0]?.address;

  const [phoneNumber, setPhoneNumber] = useState("");
  const [validationStatus, setValidationStatus] =
    useState<ValidationStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  function sanitizePhoneNumber(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  const sanitized = sanitizePhoneNumber(phoneNumber);
  const hasEnoughDigits = sanitized.length >= 10;

  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (!hasEnoughDigits || !whatsappAddress || !activeOrgId) {
      setValidationStatus("idle");
      return;
    }

    setValidationStatus("checking");

    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "whatsapp-management/contacts/check",
          {
            method: "POST",
            body: {
              organization_id: activeOrgId,
              organization_address: whatsappAddress,
              phone_number: sanitized,
            },
          },
        );

        if (error || !data) {
          setValidationStatus("unverified");
          return;
        }

        setValidationStatus(data.valid ? "valid" : "unverified");
      } catch {
        setValidationStatus("invalid");
      }
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [sanitized, activeOrgId, whatsappAddress]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader title={t("Nueva conversación")} />

      <div className="px-[20px] pb-[12px] flex">
        <div className="flex items-center w-full bg-incoming-chat-bubble h-[40px] rounded-full hover:ring ring-border px-[12px] text-foreground">
          <Search className="text-muted-foreground w-[16px] h-[16px] stroke-[3px] shrink-0" />
          <input
            placeholder={t("Buscar nombre o número de teléfono")}
            className="bg-transparent border-none outline-none w-full h-full text-[15px] mx-[12px] placeholder:text-muted-foreground"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
          {phoneNumber && (
            <div className="flex items-center gap-[6px] shrink-0">
              {validationStatus === "checking" && (
                <Spinner size={16} className="text-muted-foreground" />
              )}
              {validationStatus === "valid" && (
                <CheckCircle className="w-[18px] h-[18px] text-green-500" />
              )}
              {validationStatus === "unverified" && (
                <AlertTriangle className="w-[18px] h-[18px] text-yellow-500" />
              )}
              <X
                className="cursor-pointer text-muted-foreground w-[16px] h-[16px] stroke-[3px]"
                onClick={() => {
                  setPhoneNumber("");
                  setValidationStatus("idle");
                }}
              />
            </div>
          )}
        </div>
      </div>

      <SectionBody>
        {localAddress && (
          <SectionItem
            title={t("Nueva conversación de prueba")}
            aside={
              <div className="p-[8px] bg-primary/10 rounded-full">
                <MessageSquarePlus className="w-[24px] h-[24px] text-primary" />
              </div>
            }
            onClick={() => {
              if (!activeOrgId) {
                return;
              }

              const convId = startConversation({
                name: t("Conversación de prueba"),
                organization_id: activeOrgId,
                organization_address: localAddress.address,
                service: "local",
              });

              navigate({ to: "/conversations", hash: convId });
            }}
          />
        )}

        {!!whatsappAddress &&
          (validationStatus === "valid" || validationStatus === "unverified") && (
            <SectionItem
              title={formatPhoneNumber(sanitized)}
              description={
                validationStatus === "valid"
                  ? t("En WhatsApp")
                  : t("No se pudo verificar")
              }
              aside={
                <div className="p-[8px] bg-primary/10 rounded-full">
                  <MessageCircle className="w-[24px] h-[24px] text-primary" />
                </div>
              }
              onClick={() => {
                if (!activeOrgId) return;

                const convId = startConversation({
                  organization_id: activeOrgId,
                  organization_address: whatsappAddress,
                  contact_address: sanitized,
                  service: "whatsapp",
                  name: formatPhoneNumber(sanitized),
                });

                navigate({ to: "/conversations", hash: convId });
              }}
            />
          )}
      </SectionBody>
    </div>
  );
}
