import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCklGXD8D--9gGajUAvxH8z8NXpVzD0gUw",
  projectId: "studio-9764494180-2cb45",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const payload = {
  logId: "test-log-1",
  managerId: "manager_uid_123",
  logType: "MORNING",
  clientTimestamp: new Date().toISOString(),
  serverTimestamp: serverTimestamp(),
  
  location: {
    latitude: 6.4531,
    longitude: 1.2145,
    accuracyMeters: 10.5,
    isWithinGeofence: true
  },
  attendance: {
    worker1_mechanist: "PRESENT",
    worker2_herdsman_1: "PRESENT",
    worker3_herdsman_2: "SICK",
    worker4_forester: "PRESENT"
  },
  livestock: {
    goatsTotal: 85,
    poultryTotal: 40,
    cattleTotal: 4,
    healthIssues: "None",
    eggsCollected: 0
  },
  operations: {
    plannedTasks: "Chop 3 drums of silage, weed Teak rows 1-5",
    completedTasks: "",
    tractorFuelLevel: "75%",
    equipmentIssues: "None"
  },
  financials: {
    amountSpentXOF: 0,
    expenseReason: ""
  },
  mediaUrls: {
    photos: [
      "https://firebasestorage.googleapis.com/.../photo1.jpg",
      "https://firebasestorage.googleapis.com/.../photo2.jpg"
    ],
    video: "https://firebasestorage.googleapis.com/.../video1.mp4",
    voice: "https://firebasestorage.googleapis.com/.../voice1.mp4"
  },
  managerNotes: "Worker 3 went to the clinic for malaria. Will use Worker 4 to help with goat feeding today."
};

console.log('Adding document...');
addDoc(collection(db, 'agbelouve-farm-daily-logs'), payload).then((docRef) => {
  console.log('Test data added with ID:', docRef.id);
  process.exit(0);
}).catch(console.error);
