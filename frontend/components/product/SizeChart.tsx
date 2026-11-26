"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { bodyKeys, garmentKeys, garmentMeasurements, getSizeChart, measurements, sizeGuideHref, sizeRange, type Chart, type SizeRow } from "@/lib/size-guide";
import "./size-guide.css";

type ChartKind = "garment" | "body";
type Unit = "cm" | "in";
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export function MeasurementIllustration({ type, fit }: { type: "shirt" | "trousers" | "body"; fit?: "Slim" | "Regular" | "Oversize" }) {
  return <span aria-hidden="true" className={`measurement-illustration ${type}${fit ? ` fit-${fit.toLowerCase()}` : ""}`}>
    <span className="measure-garment" />
    {!fit && <><span className="measure-line across" />
      {type === "body" ? <span className="measure-line waist" /> : <span className="measure-line length" />}
      {type !== "shirt" && <span className="measure-line hip" />}</>}
  </span>;
}

export function MeasurementGuide({ compact = false }: { compact?: boolean }) {
  return <section className={`measurement-guide${compact ? " compact" : ""}`} aria-labelledby={compact ? "drawer-measure-title" : "measure-title"}>
    <h2 id={compact ? "drawer-measure-title" : "measure-title"}>Hướng dẫn đo kích thước</h2>
    <div className="measurement-figures">
      <figure><MeasurementIllustration type="shirt" /><figcaption>Rộng thân · Dài áo</figcaption></figure>
      <figure><MeasurementIllustration type="trousers" /><figcaption>Eo · Hông · Dài quần</figcaption></figure>
      <figure><MeasurementIllustration type="body" /><figcaption>Vòng ngực · Eo · Hông</figcaption></figure>
    </div>
    <details open={compact || undefined} className="measurement-steps">
      <summary>Cách lấy số đo</summary>
      <dl>
        <dt>Vòng ngực</dt><dd>Quấn thước ngang phần đầy nhất của ngực, giữ thước nằm ngang.</dd>
        <dt>Vòng eo</dt><dd>Đo quanh eo tự nhiên, thả lỏng và giữ thước vừa sát.</dd>
        <dt>Vòng hông</dt><dd>Đứng thẳng và đo quanh phần rộng nhất của hông.</dd>
        <dt>Chiều dài trang phục</dt><dd>Trải phẳng. Đo áo từ điểm cao nhất cạnh cổ đến gấu hoặc quần từ cạp đến gấu.</dd>
      </dl>
    </details>
  </section>;
}

function formatValue(value: number, unit: Unit, weight = false) {
  return number.format(unit === "cm" ? value : weight ? value * 2.20462262 : value / 2.54);
}

export function SizeChartTable({ rows, kind, unit = "cm", selectedSize }: { rows: SizeRow[]; kind: ChartKind; unit?: Unit; selectedSize?: string }) {
  const garment = kind === "garment" ? garmentKeys.filter((key) => rows.some((row) => row.garment?.[key] !== undefined)) : [];
  const body = kind === "body" ? bodyKeys.filter((key) => rows.some((row) => sizeRange(row, key))) : [];
  const visible = rows.filter((row) => garment.some((key) => row.garment?.[key] !== undefined) || body.some((key) => sizeRange(row, key)));
  if (!visible.length) return <p className="size-chart-empty">{kind === "garment"
    ? "Cửa hàng chưa công bố số đo thành phẩm cho lựa chọn này."
    : "Cửa hàng chưa công bố số đo cơ thể cho phom này."}</p>;
  return <div className="size-table-scroll" tabIndex={0} role="region" aria-label="Bảng kích cỡ có thể cuộn ngang">
    <table className="size-chart-table">
      <caption className="sr-only">{kind === "garment" ? "Số đo thành phẩm" : "Số đo cơ thể"}</caption>
      <thead><tr><th scope="col">Kích cỡ</th>
        {garment.map((key) => <th key={key} scope="col">{garmentMeasurements[key]} ({unit})</th>)}
        {body.map((key) => <th key={key} scope="col">{measurements[key].label} ({key === "weight" ? unit === "in" ? "lb" : "kg" : unit})</th>)}
      </tr></thead>
      <tbody>{visible.map((row) => <tr key={row.size} className={row.size === selectedSize ? "is-current-size" : undefined}>
        <th scope="row">{row.size}</th>
        {garment.map((key) => {
          const value = row.garment?.[key];
          return <td key={key}>{value === undefined ? "—" : formatValue(value, unit)}</td>;
        })}
        {body.map((key) => {
          const range = sizeRange(row, key);
          return <td key={key}>{range ? range.map((value) => formatValue(value, unit, key === "weight")).join(" – ") : "—"}</td>;
        })}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function garmentRows(rows: SizeRow[], fit: SizeRow["fit_type"] = "Regular") {
  const merged = new Map<string, SizeRow>();
  for (const row of rows) {
    if (!row.garment) continue;
    const existing = merged.get(row.size);
    if (!existing || row.fit_type === fit || (existing.fit_type !== fit && row.fit_type === "Regular")) merged.set(row.size, row);
  }
  return [...merged.values()];
}

function GarmentComparison({ rows, activeSize, unit }: { rows: SizeRow[]; activeSize?: string; unit: Unit }) {
  const [size, setSize] = useState(rows.find((row) => row.size === activeSize)?.size ?? rows[0].size);
  const [values, setValues] = useState<Record<string, string>>({});
  const garment = rows.find((row) => row.size === size)?.garment;
  return <details className="size-details size-compare">
    <summary>So sánh với trang phục của bạn</summary>
    <p className="size-chart-source">Trải phẳng một món đồ đang mặc vừa rồi đo cùng vị trí trên bảng.</p>
    <label className="size-specific-product">Kích cỡ đem so sánh
      <select value={size} onChange={(event) => setSize(event.target.value)}>
        {rows.map((row) => <option key={row.size}>{row.size}</option>)}
      </select>
    </label>
    <div className="size-fields">
      {garmentKeys.flatMap((key) => {
        const reference = garment?.[key];
        if (reference === undefined) return [];
        const amount = values[key] ? Number(values[key]) : NaN;
        const maximum = unit === "cm" ? 300 : 118.2;
        const valid = Number.isFinite(amount) && amount > 0 && amount <= maximum;
        const diff = (unit === "cm" ? reference : reference / 2.54) - amount;
        const difference = Math.round(diff * 10) / 10;
        return [<label key={key}>{garmentMeasurements[key]}
          <span className="size-input-wrap">
            <input type="number" inputMode="decimal" min="0.1" max={maximum} step="any" autoComplete="off"
              value={values[key] ?? ""} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
            <span aria-hidden="true">{unit}</span>
          </span>
          <small aria-live="polite">{valid ? (difference === 0 ? "Bằng số đo bạn nhập" : `Chênh lệch: ${difference > 0 ? "+" : ""}${number.format(difference)} ${unit}`) : " "}</small>
        </label>];
      })}
    </div>
  </details>;
}

export function ProductSizeGuide({ id, name, activeSize, sizes }: { id: string; name: string; activeSize?: string; sizes: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ChartKind>("garment");
  const [unit, setUnit] = useState<Unit>("cm");
  const [chart, setChart] = useState<Chart>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [fit, setFit] = useState<SizeRow["fit_type"]>();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    getSizeChart({ productId: id }, controller.signal).then(setChart).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải bảng kích cỡ.");
    });
    return () => controller.abort();
  }, [open, id, attempt]);

  const rows = chart?.rows ?? [];
  const bodyFits = [...new Set(rows.filter((row) => bodyKeys.some((key) => sizeRange(row, key))).map((row) => row.fit_type))];
  const bodyFit = fit && bodyFits.includes(fit) ? fit : bodyFits.includes("Regular") ? "Regular" : bodyFits[0];
  const garment = garmentRows(rows);
  return <>
    <button type="button" className="size-guide-btn" aria-haspopup="dialog" onClick={() => {
      setError(""); setOpen(true); dialog.current?.showModal();
    }}>Bảng kích cỡ</button>
    <dialog ref={dialog} className="product-size-drawer" aria-labelledby="product-size-drawer-title"
      onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="product-size-drawer-shell">
        <header><h2 id="product-size-drawer-title">Hướng dẫn đo kích cỡ</h2>
          <button type="button" aria-label="Đóng hướng dẫn đo kích cỡ" onClick={() => dialog.current?.close()}>×</button>
        </header>
        <div className="product-size-drawer-content">
          <p className="size-drawer-product">{name}</p>
          <div className="size-chart-switch" role="group" aria-label="Loại bảng kích cỡ">
            <button type="button" aria-pressed={kind === "garment"} onClick={() => setKind("garment")}>Kích cỡ sản phẩm</button>
            <button type="button" aria-pressed={kind === "body"} onClick={() => setKind("body")}>Số đo cơ thể</button>
          </div>
          <fieldset className="size-chart-units"><legend className="sr-only">Đơn vị</legend>
            <label><input type="radio" name="size-chart-unit" checked={unit === "cm"} onChange={() => setUnit("cm")} /> cm</label>
            <label><input type="radio" name="size-chart-unit" checked={unit === "in"} onChange={() => setUnit("in")} /> Inch</label>
            {kind === "body" && bodyFits.length > 1 && <label>Phom
              <select value={bodyFit} onChange={(event) => setFit(event.target.value as SizeRow["fit_type"])}>
                {bodyFits.map((entry) => <option key={entry}>{entry}</option>)}
              </select>
            </label>}
          </fieldset>
          {error ? <div role="alert" className="size-chart-empty">{error}{" "}
            <button type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Thử lại</button></div>
            : chart ? <>
              {chart.source === "category" && <p className="size-chart-source">Bảng áp dụng theo danh mục {chart.categoryName}.</p>}
              <SizeChartTable rows={kind === "garment" ? garment : rows.filter((row) => row.fit_type === bodyFit)}
                kind={kind} unit={unit} selectedSize={activeSize?.trim().toUpperCase()} />
            </> : <div className="size-skeleton" role="status" aria-label="Đang tải bảng kích cỡ" />}
          {!!sizes.length && <p className="size-chart-source">Kích cỡ sản phẩm: {sizes.join(", ")}.</p>}
          {kind === "garment" && garment.length > 0 && <GarmentComparison key={`${id}:${unit}:${garment.map((row) => row.size).join("-")}`}
            rows={garment} unit={unit} activeSize={activeSize?.trim().toUpperCase()} />}
          <MeasurementGuide compact />
          <Link className="fashion-button primary" onClick={() => dialog.current?.close()} href={sizeGuideHref({ productId: id })}>Tư vấn kích cỡ <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </dialog>
  </>;
}
