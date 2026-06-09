# -*- coding: utf-8 -*-
import json
TT = {
 "Northwest": {
   "OR": [("Bend-Sunriver RV Campground","Bend"),("Pacific City RV & Camping Resort","Cloverdale"),
          ("Seaside RV Resort","Seaside"),("Whalers Rest RV & Camping Resort","South Beach"),
          ("South Jetty RV & Camping Resort","Florence")],
   "WA": [("La Conner RV & Camping Resort","La Conner"),("Grandy Creek RV Campground","Concrete"),
          ("Crescent Bar RV Resort","Quincy"),("Chehalis RV & Camping Resort","Chehalis"),
          ("Birch Bay RV Campground","Blaine"),("Leavenworth RV Campground","Leavenworth"),
          ("Little Diamond RV Campground","Newport"),("Long Beach RV & Camping Resort","Seaview"),
          ("Thunderbird RV & Camping Resort","Monroe"),("Paradise RV Campground","Silver Creek"),
          ("Oceana RV & Camping Resort","Ocean City"),("Mount Vernon RV Campground","Bow")],
   "BC": [("Cultus Lake RV Resort","Lindell Beach")],
 },
 "Northeast": {
   "ME": [("Moody Beach RV Campground","Wells")],
   "MA": [("Sturbridge RV Resort","Sturbridge"),("Gateway to Cape Cod","Rochester")],
   "NJ": [("Sea Pines RV Resort & Campground","Swainton"),("Lake & Shore RV Resort","Ocean View"),
          ("Chestnut Lake RV Campground","Port Republic")],
   "NY": [("Rondout Valley RV Campground","Accord")],
   "PA": [("Scotrun RV Resort","Scotrun"),("PA Dutch Country RV Resort","Manheim"),
          ("Hershey RV & Camping Resort","Lebanon"),("Gettysburg Farm RV Campground","Dover"),
          ("Circle M RV & Camping Resort","Lancaster"),("Timothy Lake South RV","East Stroudsburg"),
          ("Timothy Lake North RV","East Stroudsburg")],
 },
 "Southeast": {
   "TX": [("Medina Lake RV Campground","Lakehills"),("Colorado River RV Campground","Columbus"),
          ("Lake Conroe RV & Camping Resort","Willis"),("Lake Whitney RV Campground","Whitney"),
          ("Bay Landing RV Campground","Bridgeport"),("Lake Texoma RV Campground","Gordonville"),
          ("Lake Tawakoni RV Campground","Point")],
   "TN": [("Cherokee Landing Campground","Middleton"),("Natchez Trace RV Campground","Hohenwald")],
   "AL": [("Hidden Cove Resort","Arley")],
   "SC": [("Carolina Landing RV Resort","Fair Play"),("The Oaks at Point South RV","Yemassee")],
   "NC": [("Green Mountain Park","Lenoir"),("Forest Lake RV & Camping Resort","Advance"),
          ("Lake Gaston RV & Camping Resort","Littleton")],
   "VA": [("Lynchburg RV Resort","Gladys"),("Williamsburg RV & Camping Resort","Williamsburg"),
          ("Harbor View RV & Camping Resort","Colonial Beach"),("Chesapeake Bay RV Resort","Gloucester"),
          ("Virginia Landing RV Campground","Quinby")],
   "FL": [("Three Flags RV Campground","Wildwood"),("Orlando RV Resort","Clermont"),
          ("Peace River RV & Camping Resort","Wauchula")],
 },
 "Southwest": {
   "AZ": [("Verde Valley RV & Camping Resort","Cottonwood")],
   "CA": [("Snowflower RV Resort","Emigrant Gap"),("Lake of the Springs RV Resort","Oregon House"),
          ("Lake Minden RV Resort","Nicolaus"),("Idyllwild RV Resort","Idyllwild"),
          ("Morgan Hill RV Resort","Morgan Hill"),("Oakzanita Springs RV Campground","Descanso"),
          ("San Benito RV & Camping Resort","Paicines"),("Russian River RV Campground","Cloverdale"),
          ("Rancho Oso RV & Camping Resort","Santa Barbara"),("Ponderosa RV Resort","Lotus"),
          ("Pio Pico RV Resort & Campground","Jamul"),("Palm Springs RV Resort","Palm Desert"),
          ("Yosemite Lakes RV Resort","Groveland"),("Wilderness Lakes RV Resort","Menifee"),
          ("Turtle Beach RV Resort","Manteca"),("Soledad Canyon RV & Camping Resort","Acton")],
   "CO": [("Blue Mesa Recreational Ranch","Gunnison")],
   "NV": [("Las Vegas RV Resort","Las Vegas")],
 },
 "Midwest": {
   "IL": [("Pine Country RV & Camping Resort","Belvidere")],
   "IN": [("Indian Lakes RV Campground","Batesville"),("Horseshoe Lakes RV Campground","Clinton")],
   "KY": [("Diamond Caverns RV & Golf Club","Park City")],
   "MI": [("Bear Cave RV Campground","Buchanan"),("St Clair RV Resort","Saint Clair")],
   "OH": [("Wilmington RV Resort","Wilmington"),("Kenisee Lake RV Campground","Jefferson")],
 },
}
TC = {
 "AZ": ["Araby Acres RV Resort","Cactus Gardens RV Resort","Capri RV Resort","Casita Verde RV Resort",
        "Countryside RV Resort","Desert Paradise RV Resort","Fiesta Grande RV Resort","Foothill Village RV Resort",
        "Foothills West RV Resort","Golden Sun RV Resort","Meridian RV Resort","Mesa Spirit RV Resort",
        "Mesa Verde RV Resort","Monte Vista Village RV Resort","Paradise RV Resort","Suni Sands RV Resort",
        "Valley Vista RV Resort","Venture In RV Resort","ViewPoint RV & Golf Resort","Voyager RV Resort & Hotel"],
 "CA": ["Marina Dunes RV Resort","Oceanside RV Resort","Pacific Dunes Ranch RV Resort","Palm Springs Oasis RV Resort",
        "Pilot Knob RV Resort","San Francisco RV Resort","Santa Cruz Ranch RV Resort","Tahoe Valley Campground"],
 "FL": ["Barrington Hills RV Resort","Breezy Hill RV Resort","Bulow RV Resort","Clerbrook Golf & RV Resort",
        "Clover Leaf Forest RV Resort","Crystal Isles RV Resort","Fiesta Key RV Resort","Forest Lake Village",
        "Fort Myers Beach RV Resort","Gulf Air RV Resort","Gulf View RV Resort","Harbor Lakes RV Resort",
        "Highland Woods RV Resort","Holiday Travel Park","Lake Magic RV Resort","Miami Everglades RV Resort",
        "Pioneer Village RV Resort","Ramblers Rest RV Campground","Riverside RV Resort","Rose Bay RV Resort",
        "Royal Coachman RV Resort","Sherwood Forest RV Resort","Silver Dollar RV Resort","Southern Palms RV Resort",
        "Space Coast RV Resort","Sunshine Holiday Daytona","Sunshine Holiday Ft. Lauderdale",
        "Sunshine Key RV Resort & Marina","Sunshine Travel RV Resort","Terra Ceia RV Resort","Toby's RV Resort",
        "Topics RV Resort","Tranquility Lakes RV Resort","Tropical Palms RV Resort","Vacation Village RV Resort",
        "Winter Garden RV Resort","Winter Quarters Manatee RV Resort","Winter Quarters Pasco RV Resort"],
 "IL": ["O'Connell's RV Campground"],
 "IN": ["Twin Mills Camping Resort"],
 "ME": ["Mt Desert Narrows Camping Resort","Narrows Too Camping Resort","Patten Pond Camping Resort",
        "Pinehirst RV Resort & Campground"],
 "MA": ["Old Chatham Road RV Campground"],
 "NH": ["Pine Acres Resort","Sandy Beach RV & Camping Resort","Tuxbury Pond RV Resort"],
 "NJ": ["Acorn Campground","Echo Farms Campground","King Nummy Trail Campground","Mays Landing Campground",
        "Whippoorwill Campground"],
 "NY": ["Alpine Lake RV Resort","Brennan Beach RV Resort","Lake George Escape Campground",
        "Lake George Schroon Valley Resort"],
 "NC": ["Harbor Point RV Park","Lake Myers RV & Camping Resort","Twin Lakes RV & Camping Resort",
        "Whispering Pines Campground","White Oak Shores"],
 "OR": ["Mt Hood Village RV Resort","Portland Fairview RV Park"],
 "PA": ["Appalachian RV Campground","Drummer Boy Camping Resort","Robin Hill RV Resort & Campground",
        "Round Top Campground","Spring Gulch RV Resort","Sun Valley RV Resort"],
 "TX": ["Alamo Palms RV Resort","Country Sunshine RV Resort","Fun-N-Sun RV Resort","Lakewood RV Resort",
        "Leisure World RV Resort","Paradise Park RV Resort","Paradise South RV Resort","Southern Comfort RV Resort",
        "Sunshine RV Resort","Trails End RV Resort","Tropic Winds RV Resort","Victoria Palms RV Resort"],
 "VA": ["Bethpage Camp-Resort","Grey's Point Camp"],
 "WA": ["Tall Chief RV & Camping Resort"],
 "WI": ["Arrowhead RV Campground","Blackhawk Camping Resort","Fremont RV Resort","Lake of the Woods Campground",
        "Lakeland Camping Resort","Neshonoc Lakeside Camping Resort","Plymouth Rock Camping Resort",
        "Tranquil Timbers Camping Resort","Yukon Trails RV & Camping Resort"],
}
parks=[]; pid=0
for region,states in TT.items():
    for st,items in states.items():
        for (name,city) in items:
            pid+=1; parks.append({"id":pid,"name":name,"city":city,"st":st,"network":"tt","region":region})
tt_count=pid
for st,names in TC.items():
    for name in names:
        pid+=1; parks.append({"id":pid,"name":name,"city":"","st":st,"network":"enc","region":"Trails Collection"})
enc_count=pid-tt_count
assert tt_count==82, "TT %d!=82"%tt_count
assert enc_count==122, "TC %d!=122"%enc_count
assert len({p["id"] for p in parks})==len(parks), "dup ids"
from collections import Counter
print("TT total:",tt_count,"regions:",dict(Counter(p["region"] for p in parks if p["network"]=="tt")))
print("TC total:",enc_count); print("Grand total parks:",len(parks))
def js(p): return '    { id:%d, name:%s, city:%s, st:%s, network:%s, region:%s }'%(
    p["id"],json.dumps(p["name"]),json.dumps(p["city"]),json.dumps(p["st"]),json.dumps(p["network"]),json.dumps(p["region"]))
open("parks.js","w").write("  var PARKS = [\n"+",\n".join(js(p) for p in parks)+"\n  ];\n")
print("wrote parks.js")
