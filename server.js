const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const crypto = require("crypto");

const { initializeStorage, read, write } = require("./storage");

const app = express();
const PORT = process.env.PORT || 3001;
const LLAMA_URL = process.env.LLAMA_URL || "http://127.0.0.1:8080/v1/chat/completions";
const DATA_DIR = path.join(__dirname, "data");
const DEST_FILE = path.join(DATA_DIR, "destinations.json");
const BOOK_FILE = path.join(DATA_DIR, "bookings.json");
const KNOW_FILE = path.join(DATA_DIR, "knowledge.json");
const SITE_FILE = path.join(DATA_DIR, "site-content.json");
const ADMIN_FILE = path.join(DATA_DIR, "admin-users.json");

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

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
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
app.post("/api/bookings",asyncRoute(async(req,res)=>{
  const {name,email,phone,destination,date,people,message}=req.body||{};
  if(!name||!phone||!destination||!date||!people) return res.status(400).json({error:"Fenoy azafady ny saha rehetra ilaina."});
  const all=read(BOOK_FILE,[]);
  const item={id:Date.now().toString(),name,email:email||"",phone,destination,date,people:Number(people),message:message||"",status:"Vaovao",createdAt:new Date().toISOString()};
  all.unshift(item); await write(BOOK_FILE,all);
  res.json({ok:true,message:"Voaray ny fangatahanao. Hifandray aminao izahay.",booking:item});
}));
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

app.put("/api/admin/account",auth,asyncRoute(async(req,res)=>{
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

  await write(ADMIN_FILE,accounts);
  res.json({ok:true,message:"Voatahiry ny fanovana ny kaonty.",username:account.username});
}));

app.post("/api/admin/logout",auth,(req,res)=>{
  const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,""); sessions.delete(token); res.json({ok:true});
});
app.get("/api/admin/bookings",auth,(req,res)=>res.json(read(BOOK_FILE,[])));

app.get("/api/admin/knowledge",auth,(req,res)=>res.json(read(KNOW_FILE,[])));
app.post("/api/admin/knowledge",auth,asyncRoute(async(req,res)=>{
  const {category,title,content}=req.body||{};
  if(!title||!content) return res.status(400).json({error:"Ilaina ny lohateny sy ny fanazavana."});
  const all=read(KNOW_FILE,[]);
  const item={id:Date.now().toString(),category:String(category||"Général").slice(0,80),title:String(title).slice(0,180),content:String(content).slice(0,5000),updatedAt:new Date().toISOString()};
  all.unshift(item); await write(KNOW_FILE,all); res.json({ok:true,item});
}));
app.put("/api/admin/knowledge/:id",auth,asyncRoute(async(req,res)=>{
  const all=read(KNOW_FILE,[]), item=all.find(x=>x.id===req.params.id);
  if(!item) return res.status(404).json({error:"Tsy hita"});
  const {category,title,content}=req.body||{};
  if(!title||!content) return res.status(400).json({error:"Ilaina ny lohateny sy ny fanazavana."});
  item.category=String(category||"Général").slice(0,80);
  item.title=String(title).slice(0,180);
  item.content=String(content).slice(0,5000);
  item.updatedAt=new Date().toISOString();
  await write(KNOW_FILE,all); res.json({ok:true,item});
}));
app.delete("/api/admin/knowledge/:id",auth,asyncRoute(async(req,res)=>{
  await write(KNOW_FILE,read(KNOW_FILE,[]).filter(x=>x.id!==req.params.id));
  res.json({ok:true});
}));

app.patch("/api/admin/bookings/:id",auth,asyncRoute(async(req,res)=>{
  const all=read(BOOK_FILE,[]); const item=all.find(x=>x.id===req.params.id);
  if(!item) return res.status(404).json({error:"Tsy hita"});
  item.status=String(req.body.status||"Eo am-pikarakarana"); await write(BOOK_FILE,all); res.json(item);
}));
app.delete("/api/admin/bookings/:id",auth,asyncRoute(async(req,res)=>{
  await write(BOOK_FILE,read(BOOK_FILE,[]).filter(x=>x.id!==req.params.id)); res.json({ok:true});
}));
app.post("/api/admin/destinations",auth,asyncRoute(async(req,res)=>{
  const all=read(DEST_FILE,[]); const d=req.body||{};
  if(!d.name||!d.region) return res.status(400).json({error:"Anarana sy faritra no ilaina."});
  d.slug=d.slug||d.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  d.id=d.id||Date.now().toString(); all.unshift(d); await write(DEST_FILE,all); res.json(d);
}));
app.put("/api/admin/destinations/:id",auth,asyncRoute(async(req,res)=>{
  const all=read(DEST_FILE,[]); const i=all.findIndex(x=>x.id===req.params.id);
  if(i<0) return res.status(404).json({error:"Tsy hita"});
  all[i]={...all[i],...req.body}; await write(DEST_FILE,all); res.json(all[i]);
}));
app.delete("/api/admin/destinations/:id",auth,asyncRoute(async(req,res)=>{
  await write(DEST_FILE,read(DEST_FILE,[]).filter(x=>x.id!==req.params.id)); res.json({ok:true});
}));

// Contenu modifiable du site public
app.get("/api/site-content",(req,res)=>{
  res.json(read(SITE_FILE,{}));
});
app.get("/api/admin/site-content",auth,(req,res)=>{
  res.json(read(SITE_FILE,{}));
});
app.put("/api/admin/site-content",auth,asyncRoute(async(req,res)=>{
  const content=req.body;
  if(!content || typeof content!=="object" || Array.isArray(content))
    return res.status(400).json({error:"Données invalides."});
  await write(SITE_FILE,content);
  res.json({ok:true,message:"Contenu du site enregistré."});
}));

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
    if(!process.env.GEMINI_API_KEY)
      throw new Error("GEMINI_API_KEY non configurée.");

    const r=await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-goog-api-key":process.env.GEMINI_API_KEY
        },
        signal:AbortSignal.timeout(60000),
        body:JSON.stringify({
          systemInstruction:{parts:[{text:system}]},
          contents:[{role:"user",parts:[{text:question}]}],
          generationConfig:{temperature:0.2,maxOutputTokens:450}
        })
      }
    );

    if(!r.ok){
      const details=await r.text();
      console.error("Erreur Gemini API:",r.status,details.slice(0,1000));
      throw new Error("Gemini API HTTP "+r.status);
    }

    const data=await r.json();
    const answer=data.candidates?.[0]?.content?.parts
      ?.map(part=>part.text||"").join("\\n").trim();

    if(!answer) throw new Error("Réponse Gemini vide.");

    res.json({answer,offline:false,source:"gemini"});
  }catch(e){
    console.error("Erreur IA Explore'O:",e.message);
    res.status(503).json({
      error:"L'assistant IA est temporairement indisponible. Réessayez dans quelques instants."
    });
  }
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
initializeStorage()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Explore'O mandeha sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Erreur initialisation stockage:", err.message);
    process.exit(1);
  });
