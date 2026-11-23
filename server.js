const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3001;
const LLAMA_URL = process.env.LLAMA_URL || "http://127.0.0.1:8080/v1/chat/completions";
const DATA_DIR = path.join(__dirname, "data");
const DEST_FILE = path.join(DATA_DIR, "destinations.json");
const BOOK_FILE = path.join(DATA_DIR, "bookings.json");
const KNOW_FILE = path.join(DATA_DIR, "knowledge.json");
const SITE_FILE = path.join(DATA_DIR, "site-content.json");
const ADMIN_FILE = path.join(DATA_DIR, "admin-users.json");
fs.mkdirSync(DATA_DIR, {recursive:true});

const starter = require("./data/destinations.json");
function read(file, fallback){ try { return JSON.parse(fs.readFileSync(file,"utf8")); } catch { return fallback; } }
function write(file, value){ fs.writeFileSync(file, JSON.stringify(value,null,2)); }
if (!fs.existsSync(DEST_FILE)) write(DEST_FILE, starter);
if (!fs.existsSync(BOOK_FILE)) write(BOOK_FILE, []);
if (!fs.existsSync(KNOW_FILE)) write(KNOW_FILE, []);
if (!fs.existsSync(SITE_FILE)) write(SITE_FILE, {
  brand: "Explore’O",
  hero: {
    eyebrow: "MADAGASCAR · L’ÎLE AUX MILLE DÉCOUVERTES",
    title: "Explore’O autrement.",
    description: "Voyagez, explorez et vivez des expériences uniques au cœur de l’île rouge. La beauté de Madagascar vous attend.",
    primaryLabel: "Explorer les destinations →",
    secondaryLabel: "▷ En savoir plus"
  },
  benefits: [
    {title:"Voyages sur mesure", description:"Selon vos envies"},
    {title:"Réservation sécurisée", description:"Suivi de votre demande"},
    {title:"Assistance 24/7", description:"Toujours à vos côtés"},
    {title:"Expériences uniques", description:"Découverte garantie"}
  ],
  circuits: [
    {id:"circuit-1",title:"Aventure Tsingy & Baobabs",image:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",places:"Morondava · Bekopaka",duration:"8 jours",description:"Découvrez les paysages spectaculaires des Tsingy et les célèbres baobabs de Madagascar."},
    {id:"circuit-2",title:"Nature Isalo & Ranomafana",image:"https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=80",places:"Isalo · Ranomafana",duration:"7 jours",description:"Explorez les parcs naturels et la biodiversité exceptionnelle de Madagascar."},
    {id:"circuit-3",title:"Évasion Nosy Be",image:"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",places:"Nosy Be · Nosy Iranja",duration:"5 jours",description:"Profitez des plages, des îles et des eaux turquoise du nord-ouest malgache."}
  ],
  promo: {
    eyebrow:"L’ÎLE ROUGE VOUS ATTEND",
    title:"Un voyage. Mille émotions.",
    description:"Explore’O vous accompagne pour découvrir les trésors naturels et culturels de Madagascar, à votre rythme.",
    buttonLabel:"Découvrir Madagascar →",
    buttonLink:"#destinations"
  },
  why: {
    title:"Pourquoi choisir Explore’O ?",
    items:[
      "Plus de 100 idées de destinations",
      "Circuits adaptés à votre budget",
      "Découvertes et rencontres authentiques",
      "Demande de réservation simple",
      "Assistant voyage Explore’O IA"
    ]
  },
  newsletter: {
    title:"Recevez nos inspirations de voyage",
    description:"Découvrez les merveilles de Madagascar et nos actualités.",
    buttonLabel:"S’inscrire"
  },
  footer: {
    description:"Explore’O, votre compagnon pour découvrir Madagascar.",
    contactEmail:"",
    contactPhone:"",
    facebook:"",
    copyright:"© Explore’O — Tous droits réservés"
  }
});

app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));
app.use("/api/", rateLimit({windowMs:60_000, max:100}));

const sessions = new Map();

function auth(req,res,next){
  const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!token || !sessions.has(token)) {
    return res.status(401).json({error:"Tsy maintsy miditra aloha."});
  }
  req.adminId = sessions.get(token);
  next();
}

app.get("/api/status", async (req,res)=>{
  let ai=false;
  try { const r=await fetch("http://127.0.0.1:8080/health",{signal:AbortSignal.timeout(1200)}); ai=r.ok; } catch {}
  res.json({ok:true,aiAvailable:ai, destinations:read(DEST_FILE,[]).length});
});
app.get("/api/destinations",(req,res)=>res.json(read(DEST_FILE,[])));
app.get("/api/destinations/:slug",(req,res)=>{
  const d=read(DEST_FILE,[]).find(x=>x.slug===req.params.slug);
  d?res.json(d):res.status(404).json({error:"Tsy hita"});
});
app.post("/api/bookings",(req,res)=>{
  const {name,email,phone,destination,date,people,message}=req.body||{};
  if(!name||!phone||!destination||!date||!people) return res.status(400).json({error:"Fenoy azafady ny saha rehetra ilaina."});
  const all=read(BOOK_FILE,[]);
  const item={id:Date.now().toString(),name,email:email||"",phone,destination,date,people:Number(people),message:message||"",status:"Vaovao",createdAt:new Date().toISOString()};
  all.unshift(item); write(BOOK_FILE,all);
  res.json({ok:true,message:"Voaray ny fangatahanao. Hifandray aminao izahay.",booking:item});
});
app.post("/api/admin/login",(req,res)=>{
  const {username,password}=req.body||{};
  const accounts=read(ADMIN_FILE,[]);
  const account=accounts.find(a =>
    String(a.username).toLowerCase()===String(username||"").trim().toLowerCase()
  );

  if(!account || !password) {
    return res.status(401).json({error:"Diso ny solonanarana na tenimiafina."});
  }

  const hash=crypto.scryptSync(String(password),account.salt,64);
  const saved=Buffer.from(account.passwordHash,"hex");

  if(saved.length!==hash.length || !crypto.timingSafeEqual(hash,saved)) {
    return res.status(401).json({error:"Diso ny solonanarana na tenimiafina."});
  }

  const token=crypto.randomBytes(32).toString("hex");
  sessions.set(token,account.id);
  res.json({ok:true,token,username:account.username});
});

app.get("/api/admin/me",auth,(req,res)=>{
  const accounts=read(ADMIN_FILE,[]);
  const account=accounts.find(a=>a.id===req.adminId);
  if(!account) return res.status(404).json({error:"Tsy hita ny kaonty."});
  res.json({id:account.id,username:account.username});
});

app.put("/api/admin/account",auth,(req,res)=>{
  const {username,currentPassword,newPassword}=req.body||{};
  const accounts=read(ADMIN_FILE,[]);
  const index=accounts.findIndex(a=>a.id===req.adminId);

  if(index<0) return res.status(404).json({error:"Tsy hita ny kaonty."});

  const account=accounts[index];
  const hash=crypto.scryptSync(String(currentPassword||""),account.salt,64);
  const saved=Buffer.from(account.passwordHash,"hex");

  if(saved.length!==hash.length || !crypto.timingSafeEqual(hash,saved)) {
    return res.status(401).json({error:"Diso ny tenimiafina taloha."});
  }

  const newUsername=String(username||"").trim();
  if(newUsername.length<3 || newUsername.length>40) {
    return res.status(400).json({error:"Ny solonanarana dia tokony ho 3 ka hatramin'ny 40 caractères."});
  }

  if(accounts.some((a,i)=>i!==index && a.username.toLowerCase()===newUsername.toLowerCase())) {
    return res.status(409).json({error:"Efa ampiasain'ny admin hafa io solonanarana io."});
  }

  if(newPassword && String(newPassword).length<8) {
    return res.status(400).json({error:"Ny tenimiafina vaovao dia tokony hanana caractères 8 farafahakeliny."});
  }

  account.username=newUsername;

  if(newPassword) {
    account.salt=crypto.randomBytes(16).toString("hex");
    account.passwordHash=crypto.scryptSync(String(newPassword),account.salt,64).toString("hex");
  }

  write(ADMIN_FILE,accounts);
  res.json({ok:true,message:"Voatahiry ny fanovana ny kaonty.",username:account.username});
});

app.post("/api/admin/logout",auth,(req,res)=>{
  const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,""); sessions.delete(token); res.json({ok:true});
});
app.get("/api/admin/bookings",auth,(req,res)=>res.json(read(BOOK_FILE,[])));

app.get("/api/admin/knowledge",auth,(req,res)=>res.json(read(KNOW_FILE,[])));
app.post("/api/admin/knowledge",auth,(req,res)=>{
  const {category,title,content}=req.body||{};
  if(!title||!content) return res.status(400).json({error:"Ilaina ny lohateny sy ny fanazavana."});
  const all=read(KNOW_FILE,[]);
  const item={id:Date.now().toString(),category:String(category||"Général").slice(0,80),title:String(title).slice(0,180),content:String(content).slice(0,5000),updatedAt:new Date().toISOString()};
  all.unshift(item); write(KNOW_FILE,all); res.json({ok:true,item});
});
app.put("/api/admin/knowledge/:id",auth,(req,res)=>{
  const all=read(KNOW_FILE,[]), item=all.find(x=>x.id===req.params.id);
  if(!item) return res.status(404).json({error:"Tsy hita"});
  const {category,title,content}=req.body||{};
  if(!title||!content) return res.status(400).json({error:"Ilaina ny lohateny sy ny fanazavana."});
  item.category=String(category||"Général").slice(0,80);
  item.title=String(title).slice(0,180);
  item.content=String(content).slice(0,5000);
  item.updatedAt=new Date().toISOString();
  write(KNOW_FILE,all); res.json({ok:true,item});
});
app.delete("/api/admin/knowledge/:id",auth,(req,res)=>{
  write(KNOW_FILE,read(KNOW_FILE,[]).filter(x=>x.id!==req.params.id));
  res.json({ok:true});
});

app.patch("/api/admin/bookings/:id",auth,(req,res)=>{
  const all=read(BOOK_FILE,[]); const item=all.find(x=>x.id===req.params.id);
  if(!item) return res.status(404).json({error:"Tsy hita"});
  item.status=String(req.body.status||"Eo am-pikarakarana"); write(BOOK_FILE,all); res.json(item);
});
app.delete("/api/admin/bookings/:id",auth,(req,res)=>{
  write(BOOK_FILE,read(BOOK_FILE,[]).filter(x=>x.id!==req.params.id)); res.json({ok:true});
});
app.post("/api/admin/destinations",auth,(req,res)=>{
  const all=read(DEST_FILE,[]); const d=req.body||{};
  if(!d.name||!d.region) return res.status(400).json({error:"Anarana sy faritra no ilaina."});
  d.slug=d.slug||d.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  d.id=d.id||Date.now().toString(); all.unshift(d); write(DEST_FILE,all); res.json(d);
});
app.put("/api/admin/destinations/:id",auth,(req,res)=>{
  const all=read(DEST_FILE,[]); const i=all.findIndex(x=>x.id===req.params.id);
  if(i<0) return res.status(404).json({error:"Tsy hita"});
  all[i]={...all[i],...req.body}; write(DEST_FILE,all); res.json(all[i]);
});
app.delete("/api/admin/destinations/:id",auth,(req,res)=>{
  write(DEST_FILE,read(DEST_FILE,[]).filter(x=>x.id!==req.params.id)); res.json({ok:true});
});

// Contenu modifiable du site public
app.get("/api/site-content",(req,res)=>{
  res.json(read(SITE_FILE,{}));
});
app.get("/api/admin/site-content",auth,(req,res)=>{
  res.json(read(SITE_FILE,{}));
});
app.put("/api/admin/site-content",auth,(req,res)=>{
  const content=req.body;
  if(!content || typeof content!=="object" || Array.isArray(content))
    return res.status(400).json({error:"Données invalides."});
  write(SITE_FILE,content);
  res.json({ok:true,message:"Contenu du site enregistré."});
});

app.post("/api/ai",async(req,res)=>{
  const question=String((req.body||{}).message||"").trim();
  if(!question) return res.status(400).json({error:"Manorata fanontaniana."});
  const knowledge=read(KNOW_FILE,[]);
  const destinations=read(DEST_FILE,[]);
  const words=question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").split(/[^a-z0-9]+/).filter(w=>w.length>2);
  function score(item){
    const text=[item.category,item.title,item.content,item.name,item.region,item.description].join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    return words.reduce((n,w)=>n+(text.includes(w)?1:0),0);
  }
  const facts=knowledge
    .map(x=>({x,score:score(x)}))
    .filter(v=>v.score>0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,5)
    .map(v=>({
      categorie:v.x.category,
      titre:v.x.title,
      information:String(v.x.content||"").slice(0,450)
    }));

  const rankedPlaces=destinations
    .map(x=>({x,score:score(x)}))
    .sort((a,b)=>b.score-a.score);

  const matchedPlaces=rankedPlaces.filter(v=>v.score>0);
  const selectedPlaces=(matchedPlaces.length ? matchedPlaces : rankedPlaces)
    .map(v=>v.x)
    .filter((x,i,arr)=>arr.findIndex(y=>y.name===x.name)===i)
    .slice(0,6);

  const places=selectedPlaces.map(x=>({
    nom:x.name,
    region:x.region,
    description:String(x.description||"").slice(0,300)
  }));

  // Réponse directe depuis les données vérifiées du site
  const destinationQuestion =
    /destination|lieux? à visiter|que visiter|visiter madagascar|tourist|tourisme|toerana.*(tsidihina|tsidika)|manoro.*toerana/i.test(question);

  if(destinationQuestion){
    const list=selectedPlaces.slice(0,5);
    const isMalagasy=/toerana|tsidihina|tsidika|fitsangatsanganana|manoro|azafady|aiza|inona/i.test(question);

    const answer = isMalagasy
      ? "Ireto misy toerana fizahan-tany dimy voarakitra ao amin'ny Explore’O :\\n\\n" +
        list.map((x,i)=>
          (i+1)+". **"+x.name+"**\\n"+
          "Faritra : "+(x.region||"Tsy mbola voafaritra")+"\\n"+
          "Manakaiky : "+(x.near||"Tsy mbola voafaritra")+"\\n"+
          "Mombamomba : "+(x.description||"Tsy mbola misy famaritana.")
        ).join("\\n\\n")
      : "Voici cinq destinations enregistrées dans la base Explore’O :\\n\\n" +
        list.map((x,i)=>
          (i+1)+". **"+x.name+"**\\n"+
          "Région : "+(x.region||"Non renseignée")+"\\n"+
          "À proximité : "+(x.near||"Non renseigné")+"\\n"+
          "Description enregistrée : "+(x.description||"Aucune description disponible.")
        ).join("\\n\\n");

    return res.json({answer,offline:true,source:"destinations"});
  }

  const context=JSON.stringify({
    informations_du_site:facts,
    destinations_enregistrees:places
  });

  const system="Tu es Explore’O IA, assistant touristique officiel de Madagascar. Réponds dans la langue utilisée par le visiteur. Pour les destinations, utilise uniquement les noms, régions et descriptions fournis dans les données du site. Tu peux présenter au maximum cinq destinations, sans répéter un nom. Ne prétends pas connaître des détails absents des données. N'invente jamais de tarifs, hôtels, contacts, horaires, disponibilités, transports ou prestations. Pour les prix et réservations, utilise uniquement les informations explicitement présentes dans les informations du site. Si une information manque, dis clairement qu'elle n'est pas encore renseignée et invite le visiteur à contacter l'équipe Explore’O. Si les données ne permettent pas de répondre, explique-le honnêtement. Voici les données disponibles : "+context;
  try{
    const r=await fetch(LLAMA_URL,{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(90000),
      body:JSON.stringify({model:"local-model",messages:[{role:"system",content:system},{role:"user",content:question}],temperature:0.2,max_tokens:450})});
    if(!r.ok) throw new Error("local model unavailable");
    const data=await r.json(); const answer=data.choices?.[0]?.message?.content||"Tsy nahazo valiny.";
    res.json({answer,offline:true});
  }catch(e){res.status(503).json({error:"Tsy mandeha ny IA offline amin'izao. Alefaso aloha ny llama-server ao amin'ny port 8080."});}
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`Explore'O mandeha: http://127.0.0.1:${PORT}`));
