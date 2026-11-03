// Compact emoji set (~500 popular) with keyword search, plus the bundled sticker pack.
// Data is stored per category so the picker tabs are exact.
const S='Smileys & People',AN='Animals & Nature',FD='Food & Drink',AC='Activity',TR='Travel & Places',OB='Objects',SY='Symbols';

// [emoji, keywords]
export const DATA={
 [S]:[
  ['😀','grin happy'],['😃','smile joy'],['😄','laugh smile'],['😁','beam grin'],['😆','lol xd'],
  ['😅','sweat laugh'],['🤣','rofl laugh'],['😂','joy lol cry laugh'],['🙂','slight smile'],['🙃','upside down'],
  ['😉','wink'],['😊','blush'],['😍','heart eyes love'],['🥰','love hearts'],['😘','kiss'],
  ['😎','cool sunglasses'],['🤩','starstruck wow'],['🤔','think hmm'],['🤨','eyebrow'],['😐','neutral'],
  ['😑','expressionless'],['😶','silent'],['🙄','eyeroll'],['😏','smirk'],['😴','sleep zzz'],
  ['😪','sleepy'],['🤤','drool'],['😌','relieved'],['🥲','tear smile'],['😢','cry sad'],
  ['😭','sob cry'],['😤','triumph huff'],['😠','angry'],['😡','rage mad'],['🤬','swear'],
  ['🤯','mindblown'],['😳','flushed shy'],['🥵','hot'],['🥶','cold'],['😱','scream'],
  ['😨','fearful'],['😰','anxious'],['🤗','hug'],['🤭','giggle'],['🤫','shush'],
  ['😬','grimace'],['🫡','salute'],['🥱','yawn tired'],['🤢','sick nausea'],['🤮','vomit'],
  ['🤧','sneeze'],['😷','mask sick'],['🤒','fever thermometer'],['🤕','hurt bandage'],['🤑','money face'],
  ['🤠','cowboy'],['😈','devil'],['🤡','clown'],['💩','poop'],['👻','ghost halloween'],
  ['👽','alien ufo'],['🤖','robot'],['🎃','pumpkin'],['🤝','handshake deal'],['🙏','pray thanks'],
  ['👍','thumbsup like yes ok'],['👎','thumbsdown dislike no'],['✌️','victory peace'],['🤞','luck crossed'],['🤟','loveyou'],
  ['🤘','rock'],['🤙','callme shaka'],['👌','ok perfect'],['🤌','pinch'],['✋','stop hand'],
  ['🖐️','hand five'],['🖖','spock'],['👋','wave hi hello bye'],['✊','fist power'],['💪','muscle strong'],
  ['🙌','praise raise'],['👏','clap applause'],['🫶','hearthands love'],['👀','eyes look'],['🧠','brain smart'],
  ['👶','baby'],['👦','boy'],['👧','girl'],['🧑','person'],['👨','man'],['👩','woman'],
  ['🧓','older'],['👮','police'],['🕵️','detective spy'],['💃','dancing woman'],['🕺','dancing man'],
  ['🧙','wizard magic'],['🦸','superhero'],['🤵','tuxedo'],['👰','bride'],['🤰','pregnant'],
  ['🎅','santa christmas'],['🧑‍⚕️','doctor nurse'],['🧑‍🎓','student'],['🧑‍🍳','chef cook'],['🧑‍🚀','astronaut'],
  ['🧑‍💻','developer coder'],['🧑‍🎤','singer'],
 ],
 [AN]:[
  ['🔥','fire hot lit'],['✨','sparkles shine'],['⭐','star'],['🌟','glow star'],['💫','dizzy'],
  ['🎉','party tada celebrate'],['🎊','confetti'],['🎈','balloon'],['🎁','gift present'],['🎂','birthday cake'],
  ['🐻','bear'],['🐼','panda'],['🐨','koala'],['🐯','tiger'],['🦁','lion'],
  ['🐮','cow'],['🐷','pig'],['🐸','frog'],['🐵','monkey'],['🙈','see-no-evil'],
  ['🐔','chicken'],['🐧','penguin'],['🐦','bird'],['🦆','duck'],['🦅','eagle'],
  ['🦉','owl'],['🐺','wolf'],['🐴','horse'],['🦄','unicorn'],['🐝','bee'],
  ['🦋','butterfly'],['🐌','snail'],['🐞','ladybug'],['🐢','turtle'],['🐍','snake'],
  ['🦖','dinosaur trex'],['🐙','octopus'],['🦑','squid'],['🦐','shrimp'],['🦀','crab'],
  ['🐠','fish tropical'],['🐬','dolphin'],['🐳','whale'],['🦈','shark'],['🐊','crocodile'],
  ['🦓','zebra'],['🦍','gorilla'],['🐘','elephant'],['🦒','giraffe'],['🦘','kangaroo'],
  ['🐑','sheep'],['🦙','llama'],['🐐','goat'],['🦌','deer'],['🐕','dog'],
  ['🐩','poodle'],['🐈','cat'],['🐈‍⬛','black cat'],['🐓','rooster'],['🦃','turkey'],
  ['🦚','peacock'],['🦜','parrot'],['🕊️','dove peace'],['🐇','rabbit'],['🦔','hedgehog'],
 ],
 [FD]:[
  ['🍎','apple'],['🍊','orange'],['🍋','lemon'],['🍌','banana'],['🍉','watermelon'],
  ['🍇','grapes'],['🍓','strawberry'],['🫐','blueberry'],['🍒','cherry'],['🍑','peach'],
  ['🥭','mango'],['🍍','pineapple'],['🥥','coconut'],['🥝','kiwi'],['🍅','tomato'],
  ['🥑','avocado'],['🥦','broccoli'],['🥕','carrot'],['🌽','corn'],['🥔','potato'],
  ['🍞','bread'],['🥐','croissant'],['🧀','cheese'],['🥚','egg'],['🍳','fried egg cooking'],
  ['🥞','pancakes'],['🥓','bacon'],['🍔','burger'],['🍟','fries'],['🍕','pizza'],
  ['🌭','hotdog'],['🥪','sandwich'],['🌮','taco'],['🌯','burrito'],['🍜','ramen noodles'],
  ['🍝','pasta spaghetti'],['🍣','sushi'],['🍱','bento'],['🍛','curry rice'],['🍚','rice'],
  ['🍙','onigiri'],['🥟','dumpling'],['🍦','icecream'],['🍩','donut'],['🍪','cookie'],
  ['🍰','cake shortcake'],['🧁','cupcake'],['🍫','chocolate'],['🍬','candy'],['🍭','lollipop'],
  ['☕','coffee tea'],['🍵','tea green'],['🧋','boba bubbletea'],['🥤','soda cup'],['🧃','juice'],
  ['🍺','beer'],['🍻','beers cheers'],['🥂','champagne'],['🍷','wine'],['🍸','cocktail martini'],
 ],
 [AC]:[
  ['⚽','soccer football'],['🏀','basketball'],['🏈','football'],['⚾','baseball'],['🎾','tennis'],
  ['🏐','volleyball'],['🏉','rugby'],['🎱','billiards pool'],['🏓','pingpong'],['🏸','badminton'],
  ['🥊','boxing'],['🥋','martialarts'],['🏒','hockey'],['🎯','dart target'],['🎮','game gaming'],
  ['🕹️','arcade joystick'],['🎲','dice'],['🧩','puzzle'],['♟️','chess'],['🎳','bowling'],
  ['🏃','run'],['🚴','cycling bike'],['🏋️','gym weights'],['🤸','cartwheel'],['🏆','trophy win'],
  ['🥇','gold medal'],['🥈','silver medal'],['🥉','bronze medal'],['🎫','ticket'],['🎤','microphone sing'],
  ['🎧','headphones music'],['🎸','guitar'],['🎹','piano'],['🥁','drums'],['🎻','violin'],
  ['🎨','art paint'],['🎬','movie film'],['🎭','theater'],['🎯','bullseye'],
 ],
 [TR]:[
  ['🚗','car'],['🚕','taxi'],['🚌','bus'],['🏎️','racecar f1'],['🚓','policecar'],
  ['🚑','ambulance'],['🚒','firetruck'],['🚚','truck'],['🚜','tractor'],['🛵','scooter'],
  ['🏍️','motorcycle'],['🚲','bicycle bike'],['✈️','plane travel'],['🚀','rocket ship'],['🛸','ufo'],
  ['🚁','helicopter'],['🚂','train'],['🚇','metro subway'],['🚢','ship'],['⛵','sailboat'],
  ['🗺️','map'],['🧭','compass'],['🏔️','mountain'],['🌋','volcano'],['🏝️','island'],
  ['🏖️','beach'],['🏕️','camping'],['🌅','sunrise'],['🌇','sunset'],['🌃','night city'],
  ['🎡','ferriswheel'],['🎢','rollercoaster'],['🗼','tokyo tower'],['🗽','statue liberty'],['🏰','castle'],
  ['🕌','mosque'],['⛪','church'],['🏠','house home'],['🏢','office building'],['🏥','hospital'],
 ],
 [OB]:[
  ['💡','bulb idea'],['🔋','battery'],['💻','laptop code'],['🖥️','desktop'],['⌨️','keyboard'],
  ['🖱️','mouse computer'],['💾','floppy save'],['📱','phone mobile'],['☎️','telephone'],['📺','tv'],
  ['📻','radio'],['🔍','search magnify'],['🔒','lock locked'],['🔓','unlock'],['🔑','key'],
  ['🔨','hammer'],['🛠️','tools'],['🔧','wrench'],['⚙️','gear settings'],['🧲','magnet'],
  ['💊','pill medicine'],['💉','syringe shot'],['🩺','stethoscope'],['🚪','door'],['🛋️','couch'],
  ['🛏️','bed'],['🚿','shower'],['🧹','broom'],['🗑️','trash delete'],['📝','memo note'],
  ['✏️','pencil'],['🖊️','pen'],['📚','books'],['📖','book open'],['📄','page document'],
  ['📊','bar chart data'],['📈','chart up growth'],['📉','chart down'],['🗓️','calendar'],['📎','paperclip'],
  ['✂️','scissors cut'],['📐','ruler triangular'],['💰','moneybag'],['💵','dollar'],['💳','creditcard'],
  ['🧾','receipt'],['💎','gem diamond'],['⚖️','balance justice'],['🔔','bell notification'],['🔕','bell off mute'],
  ['📢','loudspeaker'],['🔊','speaker loud'],['🎵','note music'],['🎶','notes music'],['🛒','cart shopping'],
 ],
 [SY]:[
  ['❤️','heart love red'],['🧡','orange heart'],['💛','yellow heart'],['💚','green heart'],['💙','blue heart'],
  ['💜','purple heart'],['🖤','black heart'],['🤍','white heart'],['💔','broken heart'],['💕','two hearts'],
  ['💞','revolving hearts'],['💖','sparkling heart'],['💘','cupid heart'],['💯','hundred perfect'],['✅','check done yes'],
  ['☑️','checkbox'],['✔️','check mark'],['❌','x cross no'],['❎','crossmark'],['⛔','noentry stop'],
  ['🚫','prohibited forbidden'],['⚠️','warning caution'],['♻️','recycle'],['⚡','lightning zap fast'],['💤','zzz sleep'],
  ['💥','boom collision'],['💦','droplets sweat'],['🕳️','hole'],['💣','bomb'],['💬','speech chat bubble'],
  ['💭','thought bubble'],['➕','plus add'],['➖','minus'],['✖️','multiply'],['🟰','equals'],
  ['🆗','ok button'],['🆕','new'],['🆓','free'],['🔝','top'],['🔴','red circle'],
  ['🟢','green circle'],['🔵','blue circle'],['🟣','purple circle'],['⚫','black circle'],['⚪','white circle'],
  ['🟥','red square'],['🟩','green square'],['🟦','blue square'],['⬛','black square'],['⬜','white square'],
  ['☮️','peace'],['🔱','trident'],['ॐ','om'],['✡️','star of david'],['☯️','yin yang'],
 ],
};
export const CATS=Object.keys(DATA);
export const ALL=()=>Object.values(DATA).flat();
export function searchEmoji(q){
  const s=q.trim().toLowerCase();
  if(!s)return[];
  const out=[];
  for(const arr of Object.values(DATA))for(const [e,kws] of arr)if(kws.includes(s)||kws.split(' ').some(k=>k.startsWith(s)))out.push(e);
  return [...new Set(out)].slice(0,60);
}
export const RKEY='nl-emoji-recent';
export function recents(){try{return JSON.parse(localStorage.getItem(RKEY)||'[]')}catch{return[]}}
export function pushRecent(e){
  try{const r=recents().filter(x=>x!==e);r.unshift(e);localStorage.setItem(RKEY,JSON.stringify(r.slice(0,24)))}catch{}
}
// bundled sticker pack (public/stickers/*.svg) — only the sticker id travels; receivers render their local copy
export const STICKERS=['thumbs','heart','lol','party','rocket','fire','cool','cry','wave','love','ok','think','star','ghost','robot','cat','pizza','coffee','sleep','hug','banana','boom','detective','nope'];
