const nickList = {
    "653086436": "ทิน",
    "212024655": "จารย์กานต์",
    "140793207": "พี่รกพรชก.",
    "616306042": "พี่แพนด้า",
    "140538649": "พี่ฝ่าบาท",
    "960749957": "พี่นักล่าผีมือฉมัง",
    "146342833": "พี่โฟกัส",
    "772895683": "พี่โครน่า",
    "99877169": "พี่โขง",
    "820147161": "พี่เดซี่ปาง",
    "443336052": "พี่เบ้กกกกกกกกก",
    "125793244": "พี่มนัสศานต์",
    "124179415": "พี่น้ำ",
    "637587691": "ตม.",
    "915475249": "พี่ไก่ย่าง",
    "684439683": "พี่นาโอกิ",
    "738369673": "พี่ไทยากิ",
}

// Please use event listeners to run functions.
document.addEventListener('onLoad', function (obj) {
    // obj will be empty for chat widget
    // this will fire only once when the widget loads

});

document.addEventListener('onEventReceived', function (obj) {
    // obj will contain information about the event
    console.log(obj);

    twemoji.parse(document.body);

    let msgBox = obj.detail.messageId + '-container';
    let msgAuthor = obj.detail.messageId + '-author';
    let isSub = obj.detail.subscriber;    // boolean
    let isVIP = obj.detail.tags.vip;   // string 0-1
    let isStreamer = obj.detail.owner;    // boolean
    // let msg = obj.detail.messageId + '-msg';
    // let isMod = obj.detail.tags.mod;   // string 0-1


    if (isStreamer) {
        let elementWrapper = document.getElementById(msgBox);
        elementWrapper.classList.add("chatbox-container-owner"); // Add Class For Role
        elementWrapper.classList.remove("chatbox-container");
    } else if (isSub) {
        let elementWrapper = document.getElementById(msgBox);
        elementWrapper.classList.add("chatbox-container-sub"); // Add Class For Role
        elementWrapper.classList.remove("chatbox-container");
    } else if (isVIP) {
        let elementWrapper = document.getElementById(msgBox);
        elementWrapper.classList.add("chatbox-container-vip"); // Add Class For Role
        elementWrapper.classList.remove("chatbox-container");
    }
    if (nickList[obj.detail.tags['user-id']]) {
        document.getElementById(msgAuthor).innerHTML = `${obj.detail.tags["display-name"]} (${nickList[obj.detail.tags['user-id']]})`;
    }
    document.getElementById(msgBox).style.borderLeftColor = obj.detail.tags.color;
});