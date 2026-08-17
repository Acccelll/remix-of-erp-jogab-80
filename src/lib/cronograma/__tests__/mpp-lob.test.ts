import { describe, it, expect } from "vitest";
import { parseMppXml } from "@/lib/cronograma/mpp";

// jsdom expõe DOMParser globalmente nos testes.
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Project>
  <Name>Obra Teste</Name>
  <ExtendedAttributes>
    <ExtendedAttribute>
      <FieldID>188743731</FieldID>
      <Alias>Localizacao</Alias>
    </ExtendedAttribute>
    <ExtendedAttribute>
      <FieldID>188743732</FieldID>
      <Alias>Servico LoB</Alias>
    </ExtendedAttribute>
  </ExtendedAttributes>
  <Tasks>
    <Task>
      <UID>1</UID>
      <Name>Alvenaria Pav 03</Name>
      <OutlineLevel>1</OutlineLevel>
      <OutlineNumber>1</OutlineNumber>
      <Start>2025-06-01T08:00:00</Start>
      <Finish>2025-06-05T17:00:00</Finish>
      <ExtendedAttribute><FieldID>188743731</FieldID><Value>Pav 03</Value></ExtendedAttribute>
      <ExtendedAttribute><FieldID>188743732</FieldID><Value>Alvenaria</Value></ExtendedAttribute>
    </Task>
    <Task>
      <UID>2</UID>
      <Name>Tarefa sem LoB</Name>
      <OutlineLevel>1</OutlineLevel>
      <OutlineNumber>2</OutlineNumber>
      <Start>2025-06-06T08:00:00</Start>
      <Finish>2025-06-08T17:00:00</Finish>
    </Task>
  </Tasks>
</Project>`;

describe("parseMppXml LoB aliases", () => {
  it("extrai localizacao e servicoLob de ExtendedAttribute via alias", () => {
    const { tasks } = parseMppXml(xml);
    const t1 = tasks.find((t) => t.uid === "1")!;
    expect(t1.localizacao).toBe("Pav 03");
    expect(t1.servicoLob).toBe("Alvenaria");
    const t2 = tasks.find((t) => t.uid === "2")!;
    expect(t2.localizacao).toBeUndefined();
    expect(t2.servicoLob).toBeUndefined();
  });
});
