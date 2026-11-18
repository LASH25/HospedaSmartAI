import { useState } from "react";
import type { FormEvent } from "react";
import { getToken } from "./api";

type Resultado = {
  estado: string;
  mensaje?: string;
  uuid_fiscal?: string | null;
};

export default function FacturacionCuenta({
  cuentaId, cerrada,
}: { cuentaId: string; cerrada: boolean }) {
  const [razon, setRazon] = useState("");
  const [rfc, setRfc] = useState("");
  const [regimen, setRegimen] = useState("601");
  const [postal, setPostal] = useState("");
  const [uso, setUso] = useState("G03");
  const [forma, setForma] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState("");

  const ruta = `/api/cuentas/${cuentaId}/factura`;

  async function peticion(url: string, opciones: RequestInit = {}) {
    const token = getToken();
    const r = await fetch(url, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!r.ok) {
      const datos = await r.json().catch(() => ({}));
      const mensaje = datos.message;
      throw new Error(
        Array.isArray(mensaje)
          ? mensaje.join(", ")
          : typeof mensaje === "string" ? mensaje : `Error ${r.status}`,
      );
    }
    return r;
  }

  async function consultar() {
    if (ocupado) return;
    setOcupado(true);
    setError("");
    try {
      const r = await peticion(ruta);
      setResultado(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar.");
    } finally {
      setOcupado(false);
    }
  }

  async function emitir(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setError("");
    try {
      const r = await peticion(ruta, {
        method: "POST",
        body: JSON.stringify({
          razon_social: razon.trim().toUpperCase(),
          rfc: rfc.trim().toUpperCase(),
          regimen_fiscal: regimen,
          codigo_postal: postal,
          uso_cfdi: uso,
          forma_pago: forma,
        }),
      });
      setResultado(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo emitir.");
    } finally {
      setOcupado(false);
    }
  }

  async function descargar(formato: "pdf" | "xml") {
    if (ocupado) return;
    setOcupado(true);
    setError("");
    try {
      const r = await peticion(`${ruta}/${formato}`);
      const archivo = await r.blob();
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `factura-TEST-${cuentaId}.${formato}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="module-card" style={{ padding: 24, marginBottom: 20 }}>
      <h2>Factura de prueba</h2>
      <p>
        Demostración académica en TEST, sin validez fiscal.
        El importe se obtiene de la cuenta del hotel.
      </p>
      <button type="button" disabled={ocupado} onClick={consultar}>
        Consultar factura
      </button>

      {!cerrada && (
        <p>Liquida y cierra la cuenta para habilitar la emisión.</p>
      )}

      {cerrada && resultado?.estado !== "emitida" && (
        <form onSubmit={emitir}>
          <fieldset disabled={ocupado} style={{ marginTop: 16 }}>
            <legend>Datos del receptor de prueba</legend>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}>
              <label>
                Razón social
                <input required minLength={2} maxLength={254}
                  value={razon} onChange={e => setRazon(e.target.value)} />
              </label>
              <label>
                RFC
                <input required maxLength={13}
                  value={rfc} onChange={e => setRfc(e.target.value)} />
              </label>
              <label>
                Régimen fiscal
                <input required pattern="[0-9]{3}" maxLength={3}
                  value={regimen} onChange={e => setRegimen(e.target.value)} />
              </label>
              <label>
                Código postal fiscal
                <input required pattern="[0-9]{5}" maxLength={5}
                  value={postal} onChange={e => setPostal(e.target.value)} />
              </label>
              <label>
                Uso del CFDI
                <select value={uso} onChange={e => setUso(e.target.value)}>
                  <option value="G03">G03 · Gastos en general</option>
                  <option value="S01">S01 · Sin efectos fiscales</option>
                </select>
              </label>
              <label>
                Forma de pago
                <select required value={forma}
                  onChange={e => setForma(e.target.value)}>
                  <option value="">Selecciona la forma utilizada</option>
                  <option value="01">01 · Efectivo</option>
                  <option value="03">03 · Transferencia</option>
                  <option value="04">04 · Tarjeta de crédito</option>
                  <option value="28">28 · Tarjeta de débito</option>
                </select>
              </label>
            </div>
            <button className="primary-button" type="submit"
              style={{ marginTop: 16 }}>
              {ocupado ? "Procesando…" : "Emitir factura TEST"}
            </button>
          </fieldset>
        </form>
      )}

      <div aria-live="polite">
        {error && <p className="form-error" role="alert">{error}</p>}
        {resultado && <p>{resultado.mensaje ?? resultado.estado}</p>}
        {resultado?.uuid_fiscal && <p>UUID de prueba: {resultado.uuid_fiscal}</p>}
      </div>

      {resultado?.estado === "emitida" && (
        <div style={{ display: "flex", gap: 12 }}>
          <button type="button" disabled={ocupado}
            onClick={() => descargar("pdf")}>Descargar PDF TEST</button>
          <button type="button" disabled={ocupado}
            onClick={() => descargar("xml")}>Descargar XML TEST</button>
        </div>
      )}
    </section>
  );
}
