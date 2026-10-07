import api from '../../../services/api';
export const ACCEPTANCE_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.pdf,.doc,.docx,.xls,.xlsx';
export async function uploadAcceptanceFiles(intakeId, files, onUploaded) {
 for (const item of files) {
  await api.post(`/api/service-orders/intakes/${intakeId}/acceptance-evidences`, item.file, {
   headers: {'Content-Type':'application/octet-stream'},
   transformRequest: data=>data,
   params: { name:item.file.name, upload_key:item.key },
  });
  onUploaded(item.key);
 }
}
