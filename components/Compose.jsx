'use client';
import {useEffect,useRef,useState} from 'react';
import {IC,Ic} from './ui';
import EmojiPicker from './EmojiPicker';

export default function Compose({aid,replyTo,editing,editingText,onCancelReply,onCancelEdit,onSend,onFile,onVoice,onSticker,onSchedulePick,onPoll,onLocation,placeholder,disabled,onTyping}){
  const [txt,setTxt]=useState(''),[emo,setEmo]=useState(false),[rec,setRec]=useState(null),[micErr,setMicErr]=useState(''),[att,setAtt]=useState(false);
  const taR=useRef(null),fileR=useRef(null),drafts=useRef({}),emoR=useRef(null),attR=useRef(null),recR=useRef(null);
  // drafts per chat + load on switch
  useEffect(()=>{setTxt(drafts.current[aid]||'');if(taR.current)taR.current.style.height='auto'},[aid]);
  useEffect(()=>{if(!txt)drafts.current[aid]='';else drafts.current[aid]=txt},[txt,aid]);
  // edit mode fills the box
  useEffect(()=>{if(editing){setTxt(editingText||'');taR.current?.focus()}else if(editing===null){setTxt('')}},[editing,editingText]);
  useEffect(()=>{if(replyTo)taR.current?.focus()},[replyTo]);
  useEffect(()=>{if(!emo)return;const f=e=>{if(!emoR.current?.contains(e.target))setEmo(false)};document.addEventListener('mousedown',f);return()=>document.removeEventListener('mousedown',f)},[emo]);
  useEffect(()=>{if(!att)return;const f=e=>{if(!attR.current?.contains(e.target))setAtt(false)};document.addEventListener('mousedown',f);return()=>document.removeEventListener('mousedown',f)},[att]);
  useEffect(()=>{if(!txt&&taR.current)taR.current.style.height='auto'},[txt]);
  const send=async()=>{
    const t=txt.trim();if(!t||!aid)return;
    setTxt('');setEmo(false);
    try{await onSend(t)}catch{setTxt(t)}
  };
  // ---- voice: hold mic to record, release to send, slide up (or ✕) to cancel ----
  async function startRec(y0){
    if(recR.current)return;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':'';
      const mr=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
      const ac=new AudioContext(),an=ac.createAnalyser();
      ac.createMediaStreamSource(stream).connect(an);
      an.fftSize=256;
      const r={mr,stream,ac,an,chunks:[],wave:[],t0:Date.now(),cancel:false,y0,iv:null,done:false};
      mr.ondataavailable=ev=>r.chunks.push(ev.data);
      recR.current=r;
      r.iv=setInterval(()=>{
        if(!recR.current)return clearInterval(r.iv);
        const d=new Uint8Array(an.frequencyBinCount);an.getByteFrequencyData(d);
        let s=0;for(const x of d)s+=x;
        r.wave.push(Math.max(.15,Math.min(1,s/d.length/140)));
        if(r.wave.length>36)r.wave.shift();
        setRec({ms:Date.now()-r.t0,cancel:r.cancel});
      },120);
      mr.start(200);
      setRec({ms:0,cancel:false});
      // capture release wherever the finger/mouse ends up
      const move=e=>{if(r.y0==null)return;r.cancel=e.clientY<r.y0-90;setRec(x=>({...x,cancel:r.cancel}))};
      const up=()=>{window.removeEventListener('pointermove',move);finish(true)};
      window.addEventListener('pointermove',move);
      window.addEventListener('pointerup',up,{once:true});
    }catch{
      setMicErr('Microphone unavailable');setTimeout(()=>setMicErr(''),3000);
      setRec(null);recR.current=null;
    }
  }
  async function finish(sendIt){
    const r=recR.current;if(!r||r.done)return;r.done=true;
    clearInterval(r.iv);
    const stopped=new Promise(res=>{r.mr.onstop=res;setTimeout(res,800)});
    try{r.mr.stop()}catch{}
    await stopped;
    r.stream.getTracks().forEach(t=>t.stop());
    r.ac.close().catch(()=>{});
    recR.current=null;setRec(null);
    if(!sendIt||r.cancel||!r.chunks.length)return;
    onVoice?.(new Blob(r.chunks,{type:r.mr.mimeType||'audio/webm'}),Date.now()-r.t0,r.wave);
  }
  const onMicDown=e=>{
    if(e.button!==0)return;e.preventDefault();
    startRec(e.clientY);
  };
  return <>
    {replyTo&&<div className="replybar"><span><b>{replyTo.n}</b> {replyTo.t}</span><button className="ic" onClick={onCancelReply} aria-label="Cancel reply">✕</button></div>}
    {editing&&<div className="replybar"><span><b>Editing</b> {editingText}</span><button className="ic" onClick={onCancelEdit} aria-label="Cancel edit">✕</button></div>}
    <form className="send" onSubmit={e=>{e.preventDefault();send()}}>
      <input ref={fileR} type="file" hidden onChange={e=>{onFile(e.target.files[0]);e.target.value=''}}/>
      {rec?<div className="recrow">
        <span className={'recdot'+(rec.cancel?' cancel':'')}/>
        <b>{Math.floor(rec.ms/60000)}:{String(Math.floor(rec.ms/1000)%60).padStart(2,'0')}</b>
        <span className="mute">{rec.cancel?'Release to cancel':'Release to send · slide up to cancel'}</span>
        <button type="button" className="ic bad" aria-label="Cancel recording" onClick={()=>finish(false)}>✕</button>
      </div>
      :<>
        <div className="menu" ref={attR}>
          <button type="button" className="ic" aria-label="Attach" onClick={()=>setAtt(a=>!a)}><Ic d={IC.clip}/></button>
          {att&&<div className="pop up" role="menu">
            <button type="button" role="menuitem" className="mi" onClick={()=>{setAtt(false);fileR.current.click()}}><Ic d={IC.file} s={18}/>File or photo</button>
            <button type="button" role="menuitem" className="mi" onClick={()=>{setAtt(false);onPoll?.()}}><Ic d={IC.poll} s={18}/>Poll</button>
            <button type="button" role="menuitem" className="mi" onClick={()=>{setAtt(false);onLocation?.()}}><Ic d={IC.loc} s={18}/>Location</button>
          </div>}</div>
        <textarea ref={taR} rows={1} value={txt} aria-label="Message" placeholder={placeholder||'Type a message…'} maxLength={4000} disabled={disabled}
          onPaste={e=>{const f=e.clipboardData.files[0];if(f){e.preventDefault();onFile(f)}}}
          onChange={e=>{setTxt(e.target.value);onTyping?.()}}
          onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,140)+'px'}}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send()}}}/>
        <div className="menu" ref={emoR}><button type="button" className="ic" aria-label="Emoji" onClick={()=>setEmo(!emo)}><Ic d={IC.smile}/></button>
          {emo&&<EmojiPicker stickyR={emoR}
            onEmoji={e=>{setTxt(t=>t+e);taR.current?.focus()}}
            onSticker={s=>{setEmo(false);onSticker?.(s)}}/>}</div>
        {txt.trim()
          ?<><button type="button" className="sendbtn sched" aria-label="Schedule message" title="Schedule" onClick={()=>{onSchedulePick?.(txt.trim());setTxt('')}}><Ic d={IC.clock} s={18}/></button>
            <button className="sendbtn" aria-label="Send" disabled={disabled}><Ic d={IC.send}/></button></>
          :<button type="button" className="sendbtn mic" aria-label="Hold to record a voice message" disabled={disabled}
            onPointerDown={onMicDown}><Ic d={IC.mic}/></button>}
      </>}</form>
    {micErr&&<p className="err" style={{textAlign:'center'}}>{micErr}</p>}</>;
}
