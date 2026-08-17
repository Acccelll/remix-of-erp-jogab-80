import React, { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Contact {
  nome: string;
  telefone?: string;
  email?: string;
  funcaoSetor?: string;
}

interface ContactsManagerProps {
  value?: Contact[] | null;
  onChange?: (contacts: Contact[] | null) => void;
  disabled?: boolean;
}

export function ContactsManager({ value = [], onChange, disabled = false }: ContactsManagerProps) {
  const [contacts, setContacts] = useState<Contact[]>(value || []);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newContact, setNewContact] = useState<Contact>({ nome: "", telefone: "", email: "" });

  const handleAddContact = () => {
    if (newContact.nome.trim()) {
      const updatedContacts = [...contacts, newContact];
      setContacts(updatedContacts);
      onChange?.(updatedContacts.length > 0 ? updatedContacts : null);
      setNewContact({ nome: "", telefone: "", email: "" });
    }
  };

  const handleRemoveContact = (index: number) => {
    const updatedContacts = contacts.filter((_, i) => i !== index);
    setContacts(updatedContacts);
    onChange?.(updatedContacts.length > 0 ? updatedContacts : null);
  };

  const handleUpdateContact = (index: number, field: keyof Contact, value: string) => {
    const updatedContacts = [...contacts];
    updatedContacts[index] = { ...updatedContacts[index], [field]: value || undefined };
    setContacts(updatedContacts);
    onChange?.(updatedContacts);
  };

  const handleUpdateNewContact = (field: keyof Contact, value: string) => {
    setNewContact({ ...newContact, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-medium text-sm">Contatos</h3>
      </div>

      {/* Existing Contacts */}
      <div className="space-y-2">
        {contacts.map((contact, index) => (
          <div key={index} className="flex gap-2 items-start p-3 bg-muted rounded border">
            <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
              <input
                type="text"
                placeholder="Nome do contato"
                value={contact.nome}
                onChange={(e) => handleUpdateContact(index, "nome", e.target.value)}
                disabled={disabled}
                className="px-2 py-1 border rounded bg-background"
              />
              <input
                type="tel"
                placeholder="Telefone"
                value={contact.telefone || ""}
                onChange={(e) => handleUpdateContact(index, "telefone", e.target.value)}
                disabled={disabled}
                className="px-2 py-1 border rounded bg-background"
              />
              <input
                type="email"
                placeholder="Email"
                value={contact.email || ""}
                onChange={(e) => handleUpdateContact(index, "email", e.target.value)}
                disabled={disabled}
                className="px-2 py-1 border rounded bg-background"
              />
            </div>
            <button
              onClick={() => handleRemoveContact(index)}
              disabled={disabled}
              className="p-1 text-destructive hover:bg-destructive/10 rounded transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add New Contact */}
      <div className="p-3 bg-primary/5 rounded border border-primary/20">
        <div className="grid grid-cols-3 gap-2 text-sm mb-2">
          <input
            type="text"
            placeholder="Nome do contato"
            value={newContact.nome}
            onChange={(e) => handleUpdateNewContact("nome", e.target.value)}
            disabled={disabled}
            className="px-2 py-1 border rounded bg-background"
          />
          <input
            type="tel"
            placeholder="Telefone"
            value={newContact.telefone || ""}
            onChange={(e) => handleUpdateNewContact("telefone", e.target.value)}
            disabled={disabled}
            className="px-2 py-1 border rounded bg-background"
          />
          <input
            type="email"
            placeholder="Email"
            value={newContact.email || ""}
            onChange={(e) => handleUpdateNewContact("email", e.target.value)}
            disabled={disabled}
            className="px-2 py-1 border rounded bg-background"
          />
        </div>
        <button
          onClick={handleAddContact}
          disabled={disabled || !newContact.nome.trim()}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 text-sm rounded font-medium",
            disabled || !newContact.nome.trim()
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer",
          )}
        >
          <Plus className="w-4 h-4" />
          Adicionar Contato
        </button>
      </div>

      {contacts.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Nenhum contato adicionado ainda</p>
      )}
    </div>
  );
}
