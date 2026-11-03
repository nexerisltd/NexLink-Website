'use client';
import {useEffect,useRef} from 'react';
import 'leaflet/dist/leaflet.css';

// Small OpenStreetMap viewer for shared/live locations (no API key needed).
export default function MapView({points,meId}){
  const el=useRef(null);
  useEffect(()=>{
    let map=null;
    (async()=>{
      const L=await import('leaflet');
      const pts=points.filter(p=>typeof p.lat==='number');
      if(!el.current||!pts.length)return;
      map=L.map(el.current,{zoomControl:true}).setView([pts[0].lat,pts[0].lng],14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
      const bounds=[];
      pts.forEach(p=>{
        const m=L.circleMarker([p.lat,p.lng],{radius:9,color:'#2b7bff',fillColor:p.sender_id===meId?'#4f9bff':'#f43f5e',fillOpacity:.9,weight:2}).addTo(map);
        m.bindPopup(p.name||'');
        bounds.push([p.lat,p.lng]);
      });
      if(bounds.length>1)map.fitBounds(bounds,{padding:[30,30]});
    })();
    return()=>{map?.remove()};
  },[points,meId]);
  return <div ref={el} style={{height:320,borderRadius:14,background:'#dbe6ff'}}/>;
}
