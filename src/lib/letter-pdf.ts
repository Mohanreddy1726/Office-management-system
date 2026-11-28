"use client";

export function decodeHtmlDataUrl(fileUrl?: string): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith("data:text/html")) return null;
  const idx = fileUrl.indexOf(",");
  if (idx < 0) return null;
  const header = fileUrl.slice(0, idx);
  const body = fileUrl.slice(idx + 1);
  try {
    if (header.includes(";base64")) {
      const bin = atob(body);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return new TextDecoder("utf-8").decode(bytes);
    }
    return decodeURIComponent(body);
  } catch {
    return null;
  }
}

export async function downloadHtmlLetterAsPdf(html: string, filename: string): Promise<void> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "840px";
  iframe.style.height = "1200px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Could not initialize PDF renderer frame.");

    doc.open();
    doc.write(html);
    doc.close();

    // Wait for fonts & images to finish loading inside the isolated frame
    await new Promise<void>((resolve) => {
      const checkReady = () => {
        if (doc.readyState === "complete") resolve();
        else setTimeout(checkReady, 40);
      };
      checkReady();
    });

    try {
      await (doc as any).fonts?.ready;
    } catch {}

    const imgs = Array.from(doc.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((res) => {
            if (img.complete) return res();
            img.addEventListener("load", () => res(), { once: true });
            img.addEventListener("error", () => res(), { once: true });
            setTimeout(res, 4000);
          })
      )
    );

    const pages = Array.from(doc.querySelectorAll(".page")) as HTMLElement[];
    if (pages.length === 0) {
      throw new Error("No letter pages found to render.");
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [794, 1123],
    });

    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 794,
        height: 1123,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.96);
      if (i > 0) pdf.addPage([794, 1123], "portrait");
      pdf.addImage(imgData, "JPEG", 0, 0, 794, 1123);
    }

    const safeName = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
    pdf.save(safeName);
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}
