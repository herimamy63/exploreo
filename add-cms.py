from pathlib import Path

p = Path("public/admin.html")
s = p.read_text()

old = "<a href=\"#\" onclick=\"tab('knowledge')\">✦ Base IA</a>"
new = old + "<a href=\"#\" onclick=\"tab('site')\">✎ Contenu du site</a>"
assert old in s, "Lien Base IA introuvable"
s = s.replace(old, new, 1)

old = '</section>\n</main></div>\n<script>'
new = '''</section>
<section id="site" style="display:none">
<div class="panel">
<h3>Contenu général du site public</h3>
<p class="muted">Ovay eto ny votoatin'ny pejy public.</p>
<div id="siteEditor">Chargement...</div>
</div>
<div class="panel">
<h3>Circuits touristiques</h3>
<div id="circuitEditor"></div>
<button class="btn" type="button" onclick="addCircuit()">＋ Ajouter un circuit</button>
</div>
<div class="panel">
<button class="btn" type="button" onclick="saveSiteContent()">Enregistrer les modifications</button>
<p id="siteMessage" class="muted"></p>
</div>
</section>
</main></div>
<script>'''
assert old in s, "Emplacement des sections introuvable"
s = s.replace(old, new, 1)

s = s.replace(
"let token='',destinations=[],bookings=[],knowledge=[];",
"let token='',destinations=[],bookings=[],knowledge=[],siteContent={};",
1
)

s = s.replace(
"knowledge=await api('/api/admin/knowledge');$('sDest')",
"knowledge=await api('/api/admin/knowledge');siteContent=await api('/api/admin/site-content');$('sDest')",
1
)

s = s.replace(
"renderDest();renderKnowledge()}",
"renderDest();renderKnowledge();renderSiteContent()}",
1
)

s = s.replace(
"['dash','dest','book','knowledge'].forEach",
"['dash','dest','book','knowledge','site'].forEach",
1
)

s = s.replace(
"knowledge:'Base de connaissances IA'}[id]",
"knowledge:'Base de connaissances IA',site:'Contenu du site public'}[id]",
1
)

anchor = "function esc(s=''){"
cms = r'''
function renderSiteContent(){
 const c=siteContent||{},h=c.hero||{},p=c.promo||{},w=c.why||{},n=c.newsletter||{},f=c.footer||{};
 const field=(label,key,value='')=>`<label>${label}</label><input data-site="${key}" value="${esc(value)}">`;
 const area=(label,key,value='')=>`<label>${label}</label><textarea data-site="${key}" rows="3">${esc(value)}</textarea>`;
 $('siteEditor').innerHTML=`
 <h4>Identité</h4>${field('Nom du site','brand',c.brand)}
 <h4>Page d’accueil — Hero</h4>
 ${field('Petit titre','hero.eyebrow',h.eyebrow)}
 ${field('Grand titre','hero.title',h.title)}
 ${area('Description','hero.description',h.description)}
 ${field('Bouton principal','hero.primaryLabel',h.primaryLabel)}
 ${field('Bouton secondaire','hero.secondaryLabel',h.secondaryLabel)}
 <h4>Avantages</h4>
 <p class="muted">Lohateny | Description, andalana iray isaky ny avantage.</p>
 <textarea data-site="benefits" rows="5">${esc((c.benefits||[]).map(x=>x.title+' | '+x.description).join('\n'))}</textarea>
 <h4>Promotion</h4>
 ${field('Petit titre','promo.eyebrow',p.eyebrow)}
 ${field('Grand titre','promo.title',p.title)}
 ${area('Description','promo.description',p.description)}
 ${field('Texte du bouton','promo.buttonLabel',p.buttonLabel)}
 ${field('Lien du bouton','promo.buttonLink',p.buttonLink)}
 <h4>Pourquoi choisir Explore’O ?</h4>
 ${field('Titre','why.title',w.title)}
 <textarea data-site="why.items" rows="5">${esc((w.items||[]).join('\n'))}</textarea>
 <h4>Newsletter</h4>
 ${field('Titre','newsletter.title',n.title)}
 ${area('Description','newsletter.description',n.description)}
 ${field('Bouton','newsletter.buttonLabel',n.buttonLabel)}
 <h4>Footer et contacts</h4>
 ${area('Description','footer.description',f.description)}
 ${field('E-mail','footer.contactEmail',f.contactEmail)}
 ${field('Téléphone','footer.contactPhone',f.contactPhone)}
 ${field('Facebook','footer.facebook',f.facebook)}
 ${field('Copyright','footer.copyright',f.copyright)}`;
 renderCircuits();
}
function renderCircuits(){
 const arr=siteContent.circuits||[];
 $('circuitEditor').innerHTML=arr.map((c,i)=>`
 <div class="panel" style="border:1px solid #dce3ed">
 <h4>Circuit ${i+1}</h4>
 <label>Nom</label><input data-circuit="${i}" data-key="title" value="${esc(c.title)}">
 <label>Image URL</label><input data-circuit="${i}" data-key="image" value="${esc(c.image)}">
 <label>Lieux</label><input data-circuit="${i}" data-key="places" value="${esc(c.places)}">
 <label>Durée</label><input data-circuit="${i}" data-key="duration" value="${esc(c.duration)}">
 <label>Description</label><textarea data-circuit="${i}" data-key="description">${esc(c.description)}</textarea>
 <button class="btn danger" type="button" onclick="removeCircuit(${i})">Supprimer</button>
 </div>`).join('')||'<p>Aucun circuit.</p>';
}
function addCircuit(){
 if(!siteContent.circuits)siteContent.circuits=[];
 siteContent.circuits.push({id:'circuit-'+Date.now(),title:'Nouveau circuit',image:'',places:'',duration:'',description:''});
 renderCircuits();
}
function removeCircuit(i){
 if(confirm('Supprimer ce circuit ?')){siteContent.circuits.splice(i,1);renderCircuits();}
}
async function saveSiteContent(){
 try{
  const get=k=>document.querySelector(`[data-site="${k}"]`)?.value||'';
  const c=siteContent;
  c.brand=get('brand');
  c.hero={eyebrow:get('hero.eyebrow'),title:get('hero.title'),description:get('hero.description'),primaryLabel:get('hero.primaryLabel'),secondaryLabel:get('hero.secondaryLabel')};
  c.benefits=get('benefits').split('\n').filter(Boolean).map(line=>{const a=line.split('|');return {title:(a.shift()||'').trim(),description:a.join('|').trim()}});
  c.promo={eyebrow:get('promo.eyebrow'),title:get('promo.title'),description:get('promo.description'),buttonLabel:get('promo.buttonLabel'),buttonLink:get('promo.buttonLink')};
  c.why={title:get('why.title'),items:get('why.items').split('\n').map(x=>x.trim()).filter(Boolean)};
  c.newsletter={title:get('newsletter.title'),description:get('newsletter.description'),buttonLabel:get('newsletter.buttonLabel')};
  c.footer={description:get('footer.description'),contactEmail:get('footer.contactEmail'),contactPhone:get('footer.contactPhone'),facebook:get('footer.facebook'),copyright:get('footer.copyright')};
  document.querySelectorAll('[data-circuit]').forEach(el=>{const i=Number(el.dataset.circuit);if(c.circuits[i])c.circuits[i][el.dataset.key]=el.value;});
  const r=await api('/api/admin/site-content',{method:'PUT',body:JSON.stringify(c)});
  $('siteMessage').textContent=r.message||'Enregistré';
  alert('Vita voatahiry ny contenu.');
 }catch(e){alert(e.message);$('siteMessage').textContent=e.message;}
}
'''
assert anchor in s, "Fonction esc introuvable"
s = s.replace(anchor, cms + "\n" + anchor, 1)

p.write_text(s)
print("VITA: tafiditra ny CMS ao amin'ny Admin.")
