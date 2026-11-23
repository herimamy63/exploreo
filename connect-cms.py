from pathlib import Path

p = Path("public/index.html")
s = p.read_text()

# Ampiana ID ahafahana manavao ireo blocs
old = '<div class="benefits">'
new = '<div class="benefits" id="benefitsGrid">'
if s.count(old) != 1:
    raise SystemExit("Tsy hita na miverimberina ny bloc benefits.")
s = s.replace(old, new, 1)

old = '<footer class="footer">'
new = '<footer class="footer" id="siteFooter">'
if s.count(old) != 1:
    raise SystemExit("Tsy hita na miverimberina ny footer.")
s = s.replace(old, new, 1)

start = s.find("const circuits=[")
end = s.find("loadDest();", start)

if start < 0 or end < 0:
    raise SystemExit("Tsy hita ny JavaScript circuits. Tsy nisy fanovana voatahiry.")

end += len("loadDest();")

js = r'''
function safeSiteText(v){return String(v ?? "");}

function safeSiteUrl(v){
  const s=safeSiteText(v).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^(\/|\.\/)/.test(s)) return s;
  return "";
}

async function loadSiteContent(){
 try{
  const r=await fetch("/api/site-content",{cache:"no-store"});
  if(!r.ok) throw new Error("HTTP "+r.status);
  const d=await r.json();

  const setText=(sel,val)=>{
    const el=document.querySelector(sel);
    if(el && val!==undefined && val!==null) el.textContent=safeSiteText(val);
  };

  const brand=safeSiteText(d.brand || "Explore’O");
  document.querySelectorAll(".brand span").forEach(el=>el.textContent=brand);

  const h=d.hero || {};
  setText(".hero .eyebrow",h.eyebrow);
  setText(".hero h1",h.title);
  setText(".hero-content > p",h.description);

  const buttons=document.querySelectorAll(".hero-actions a");
  if(buttons[0]) buttons[0].textContent=safeSiteText(h.primaryLabel || buttons[0].textContent);
  if(buttons[1]) buttons[1].textContent=safeSiteText(h.secondaryLabel || buttons[1].textContent);

  const icons=["🌴","🛡️","🎧","⭐","✨","🌺","🧭","🏝️"];
  const benefits=Array.isArray(d.benefits)?d.benefits:[];
  const bg=document.getElementById("benefitsGrid");
  if(bg) bg.innerHTML=benefits.map((b,i)=>
   `<div class="benefit"><div class="ico">${icons[i%icons.length]}</div><div><b>${escapeHtml(safeSiteText(b.title))}</b><small>${escapeHtml(safeSiteText(b.description))}</small></div></div>`
  ).join("");

  const circuits=Array.isArray(d.circuits)?d.circuits:[];
  const cg=document.getElementById("circuitGrid");
  if(cg) cg.innerHTML=circuits.map(c=>{
   const title=safeSiteText(c.title);
   const image=safeSiteUrl(c.image);
   return `<article class="circuit">
    ${image?`<img loading="lazy" src="${escapeHtml(image)}" alt="${escapeHtml(title)}">`:""}
    <div class="circuit-body">
     <span class="pill">${escapeHtml(safeSiteText(c.duration))}</span>
     <h3>${escapeHtml(title)}</h3>
     <p>⌖ ${escapeHtml(safeSiteText(c.places))}<br>${escapeHtml(safeSiteText(c.description))}</p>
     <a class="textlink" href="#" data-destination="${escapeHtml(title)}" onclick="openBooking(this.dataset.destination);return false">Demander ce circuit →</a>
    </div></article>`;
  }).join("") || '<p class="empty">Aucun circuit disponible.</p>';

  const promo=d.promo || {};
  setText(".promo .eyebrow",promo.eyebrow);
  setText(".promo h2",promo.title);
  setText(".promo p",promo.description);
  const pl=document.querySelector(".promo a");
  if(pl){
   pl.textContent=safeSiteText(promo.buttonLabel || pl.textContent);
   const link=safeSiteText(promo.buttonLink || "#destinations");
   pl.setAttribute("href",link.startsWith("#")?link:(safeSiteUrl(link)||"#destinations"));
  }

  const why=d.why || {};
  setText(".why h2",why.title);
  const wl=document.querySelector(".why ul");
  if(wl) wl.innerHTML=(Array.isArray(why.items)?why.items:[])
   .map(x=>`<li>${escapeHtml(safeSiteText(x))}</li>`).join("");

  const newsletter=d.newsletter || {};
  setText(".newsletter h3",newsletter.title);
  setText(".newsletter p",newsletter.description);
  setText(".newsletter button",newsletter.buttonLabel);

  const f=d.footer || {};
  const footer=document.getElementById("siteFooter");
  if(footer){
   const email=safeSiteText(f.contactEmail).trim();
   const phone=safeSiteText(f.contactPhone).trim();
   const facebook=safeSiteText(f.facebook).trim();
   const fbUrl=/^https?:\/\//i.test(facebook)?facebook:"";

   footer.innerHTML=`
    <div>
     <div class="brand" style="color:white"><img src="logo.png" alt=""><span>${escapeHtml(brand)}</span></div>
     <small>${escapeHtml(safeSiteText(f.description))}</small>
    </div>
    <div><b>Explorer</b><p>
     <a href="#destinations">Destinations</a><br>
     <a href="#circuits">Circuits</a><br>Hébergements
    </p></div>
    <div><b>Contact</b>
     ${email?`<p><a href="mailto:${escapeHtml(email)}">E-mail : ${escapeHtml(email)}</a></p>`:""}
     ${phone?`<p><a href="tel:${escapeHtml(phone)}">Téléphone : ${escapeHtml(phone)}</a></p>`:""}
     ${facebook?`<p>${fbUrl?`<a href="${escapeHtml(fbUrl)}" target="_blank" rel="noopener noreferrer">Facebook</a>`:`Facebook : ${escapeHtml(facebook)}`}</p>`:""}
    </div>
    <div><b>${escapeHtml(brand)}</b>
     <p><a href="#apropos">À propos</a><br><a href="#contact">Contact</a></p>
     <p><a class="admin-link" href="admin.html">Accès administrateur →</a></p>
     <small>${escapeHtml(safeSiteText(f.copyright))}</small>
    </div>`;
  }

  document.title=brand+" — Madagascar";
 }catch(e){
  console.error("Erreur chargement CMS:",e);
 }
}

loadDest();
loadSiteContent();
'''

s = s[:start] + js + s[end:]
p.write_text(s)
print("VITA: mifandray amin'ny CMS ny public.")
