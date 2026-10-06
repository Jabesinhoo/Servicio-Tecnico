import {createPlugin} from '@fullcalendar/core';
// Colombia uses UTC-05:00 throughout the year.
class BogotaTimeZone {
 offsetForArray(){return -300;}
 timestampToArray(ms){const d=new Date(ms-5*3600000);return[d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds(),d.getUTCMilliseconds()];}
}
export default createPlugin({name:'bogota-time-zone',namedTimeZonedImpl:BogotaTimeZone});
