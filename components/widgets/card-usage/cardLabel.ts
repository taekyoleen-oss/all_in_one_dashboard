/**
 * card-usage · cardLabel — render a card's display label (설계서 §2.1 #9).
 *
 *  Shows the nickname + the last 4 digits ("•• 1234") when present. NEVER renders
 *  a full card number (only last4 is ever stored, per the D5 guardrail). Falls
 *  back to a placeholder when the card is missing (e.g. a txn whose card was
 *  deleted).
 */

import type { Card } from "@/output/api-shapes";

export function cardLabel(card: Card | undefined): string {
  if (!card) return "(삭제된 카드)";
  const tail = card.last4 ? ` •• ${card.last4}` : "";
  return `${card.nickname}${tail}`;
}

/** Just the masked-tail fragment ("•• 1234"), or "" when no last4. */
export function cardTail(card: Card | undefined): string {
  return card?.last4 ? `•• ${card.last4}` : "";
}
