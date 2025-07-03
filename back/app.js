const {
  express,
  fs,
  bodyParser,
  Server,
  createCanvas,
  cors,
  tf,
} = require('./js/dependence');
const {
	port,
} = require("./js/config");
const app=express();
app.use(bodyParser.urlencoded({extended:false}));// extended:true pour prendre en charge les sous-objet
app.set("views", __dirname+"/html");
app.use(express.static("css"));
app.use(express.static("images"));
app.use(express.static("js"));
app.engine("html",require("ejs").renderFile);
app.engine("css",require("ejs").renderFile);
app.engine("ico",require("ejs").renderFile);
app.engine("js",require("ejs").renderFile);
// Ecoute du serveur
if (!port) {
  console.error("ERREUR : process.env.PORT est non défini !");
  process.exit(1);
}
const server = app.listen(port,(err)=>{
  if(err){
    console.log("Le serveur n'a pas pu démarrer");
  } else{
    console.log("Le serveur est en écoute sur le port " + port);
  }
});
const io = new Server(server);
let model_loaded = false;
let loadedModel = null;
// Créer les différente réponce au action demmander par les client
app.get("/",(req,res)=>{
	res.render("index.html",{});
})
app.post("/entrainee",(req,res)=>{
  modeEntrainement = true;
  horloge();
  res.send("Entraînement en cours");
})
app.post("/jouer",(req,res)=>{
  modeEntrainement = false;
  horloge();
  res.send("Jeu en cours");
})
// Crée le réseau de neurones
function createModel(){
  const model = tf.sequential();
  model.add(tf.layers.dense({inputShape:[4],units:32,activation:"relu"}));// inputShape 2 entrée, units 32 neurone pour la premiaire couche
  model.add(tf.layers.dense({units:32,activation:"relu"}));// units 32 neurone pour la deuxieme couche
  model.add(tf.layers.dense({units:actions.length,activation:"linear"}));// units actions.length actions possibles
  model.compile({ optimizer:"adam",loss:"meanSquaredError"});
  return model;
}
// Définir les actions possibles
const actions = [0,45,90,135,180,225,270,315];
// inissialisation de variables
const longueur_terrain = 1200;
const largeur_terrain = longueur_terrain / 1.75;
const rayon_robot = largeur_terrain / 35;
let vitesse = 0;
let xr1 = largeur_terrain / 2;
let yr1 = longueur_terrain / 2;
let direction_r1_deg = 135;// 0 = horizontal gauche en sens inverce des éguille d'une montre
const canvas = createCanvas(largeur_terrain,longueur_terrain);
const ctx = canvas.getContext("2d",{willReadFrequently:true});
dataUrl = canvas.toDataURL();
io.emit("image",dataUrl);
io.on("connection",(socket) => {
  let dataUrl = canvas.toDataURL();
  socket.emit("image",dataUrl);
});
//let model_loaded = false;
// Fonction dessin
function dessin(){
  ctx.clearRect(0,0,largeur_terrain,longueur_terrain);
  // Dessine la ligne mediane
  ctx.beginPath();
  ctx.moveTo(0,longueur_terrain / 2);
  ctx.lineTo(largeur_terrain,longueur_terrain / 2);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.stroke();
  // Dessine le point au milieu du terin
  ctx.beginPath();
  ctx.fillStyle = "white";
  ctx.arc(largeur_terrain / 2,longueur_terrain / 2,largeur_terrain / 70,0,Math.PI * 2);
  ctx.fill();
  // Dessine l'objectif
  ctx.beginPath();
  ctx.fillStyle = "white";
  ctx.arc(objectifX,objectifY,largeur_terrain / 70,0,Math.PI * 2);
  ctx.fill();
  // Dessine la zone de réconpence
  ctx.beginPath();
  ctx.fillStyle = "white";
  ctx.arc(objectifX,objectifY,(largeur_terrain / 70) + 50,0,Math.PI * 2);
  ctx.stroke();
  // Dessine les lignes de but
  ctx.beginPath();
  ctx.moveTo((largeur_terrain / 2) - 20,0);
  ctx.lineTo((largeur_terrain / 2) + 20,0);
  ctx.strokeStyle = "red";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((largeur_terrain / 2) - 20,longueur_terrain);
  ctx.lineTo((largeur_terrain / 2) + 20,longueur_terrain);
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 4;
  ctx.stroke();
  // Dessine le robot
  ctx.beginPath();
  ctx.fillStyle = "#f00";
  ctx.arc(xr1,yr1,rayon_robot,0,Math.PI * 2);
  ctx.fill();
  const dataUrl = canvas.toDataURL();
  io.emit("image",dataUrl);
}
// Créer une récompense
const objectifX = largeur_terrain - (largeur_terrain / 4);
const objectifY = longueur_terrain / 4;
let lastDistance = null;
function getReward(x, y) {
  const distance = Math.sqrt((x - objectifX) ** 2 + (y - objectifY) ** 2);
  let reward = 0;
  // Récompense basée sur la réduction de la distance
  if(lastDistance !== null){
    reward += lastDistance - distance;// positif si on se rapproche
  }
  lastDistance = distance;
  return reward;
}
// Paramaitre d'aprentissage de l'IA
const model = createModel();
let explorationRate = 1;
const explorationDecay = 0.9997;
const explorationMin = 0.3;//0.5
const discountFactor = 0.8;
// Choisir une action (exploration ou exploitation)
function chooseAction(state) {
  if (Math.random() < explorationRate) {
    return Math.floor(Math.random() * actions.length); // aléatoire
  } else {
    const inputTensor = tf.tensor2d([state]);
    const prediction = model.predict(inputTensor);
    const actionIndex = prediction.argMax(1).dataSync()[0];
    inputTensor.dispose();
    prediction.dispose();
    return actionIndex;
  }
}
// Entraînement du model
const entrainement = async () => {
  console.log(explorationRate);
  // État courant (normalisé)
  const state = [xr1 / largeur_terrain, yr1 / longueur_terrain,objectifX / largeur_terrain,objectifY / longueur_terrain];
  // Choix de l'action
  const actionIndex = chooseAction(state);
  const action = actions[actionIndex];
  // Appliquer l'action
  direction_r1_deg = actions[actionIndex];
  vitesse_r1 = 1;
  // Déplacement
  const direction_r1_rad = direction_r1_deg * (Math.PI / 180);
  const coeffX = Math.cos(direction_r1_rad);
  const coeffY = Math.sin(direction_r1_rad);
  xr1 -= vitesse_r1 * coeffX;
  yr1 += vitesse_r1 * coeffY;
  // Empêche de sortir du terrain
  //xr1 = Math.max(rayon_robot, Math.min(largeur_terrain - rayon_robot, xr1));
  //yr1 = Math.max(rayon_robot, Math.min(longueur_terrain - rayon_robot, yr1));
  // Nouvel état et récompense
  const newState = [xr1 / largeur_terrain, yr1 / longueur_terrain,objectifX / largeur_terrain,objectifY / longueur_terrain];
  const reward = getReward(xr1, yr1);
  // Prédiction Q-values
  const oldQ = model.predict(tf.tensor2d([state]));
  const newQ = model.predict(tf.tensor2d([newState]));
  const oldQValues = oldQ.dataSync();
  const newQValues = newQ.dataSync();
  const targetQ = [...oldQValues];
  const bestFutureQ = Math.max(...newQValues);
  targetQ[actionIndex] = reward + discountFactor * bestFutureQ;
  await model.fit(
    tf.tensor2d([state]),
    tf.tensor2d([targetQ]),
    { epochs: 1, verbose: 0 }
  );
  oldQ.dispose();
  newQ.dispose();
  // Mise à jour exploration
  if (explorationRate > explorationMin) {
    explorationRate *= explorationDecay;// diminue progressivement explorationRate
  }
  // Affichage
  dessin();
}
let intervalId = null;
function horloge(){
  if(intervalId !== null) return; // ne lance pas si déjà en cours
  explorationRate = 1;         // remise à 1 pour un nouvel entraînement
  xr1 = largeur_terrain / 2;
  yr1 = longueur_terrain / 2;
  direction_r1_deg = 135;
  lastDistance = null;
  intervalId = setInterval(async () => {
    if(modeEntrainement == true){
      await entrainement();
      if(explorationRate <= explorationMin){
        // Sauvegarde du model et arrer du setInterval
        const saveModel = async (model) => {
          const saveResult = await model.save(tf.io.withSaveHandler(async (artifacts) => {
            fs.mkdirSync('./ia', { recursive: true });
            fs.writeFileSync('./ia/mon_modele.json', JSON.stringify(artifacts.modelTopology));
            fs.writeFileSync('./ia/mon_modele.weights.bin', Buffer.from(artifacts.weightData));
            return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON', weightDataBytes: artifacts.weightData.byteLength } };
          }))
        }
        await saveModel(model);
        clearInterval(intervalId);
        intervalId = null;// remet à null pour permettre relancement
        console.log("Entraînement terminé");
      }
    }else{
      if (!model_loaded) {
        const modelJson = fs.readFileSync('./ia/valider/mon_modele.json', 'utf8');
        const modelWeights = fs.readFileSync('./ia/valider/mon_modele.weights.bin');
        const handler = tf.io.fromMemory(JSON.parse(modelJson), modelWeights.buffer);
        loadedModel = await tf.loadLayersModel(handler);

        model_loaded = true;
      }
      const state = [xr1 / largeur_terrain, yr1 / longueur_terrain, objectifX / largeur_terrain, objectifY / longueur_terrain];
      const inputTensor = tf.tensor2d([state]);
      //const prediction = model.predict(inputTensor);
      const prediction = loadedModel.predict(inputTensor);
      const actionIndex = prediction.argMax(1).dataSync()[0];
      inputTensor.dispose();
      prediction.dispose();
      direction_r1_deg = actions[actionIndex];
      vitesse_r1 = 1;
      const direction_r1_rad = direction_r1_deg * (Math.PI / 180);
      const coeffX = Math.cos(direction_r1_rad);
      const coeffY = Math.sin(direction_r1_rad);
      xr1 -= vitesse_r1 * coeffX;
      yr1 += vitesse_r1 * coeffY;
      dessin();
    }
  },20);
}