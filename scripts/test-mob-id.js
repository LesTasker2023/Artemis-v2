/**
 * Test mob identification with database
 */
import { MobIdentificationServiceV2 } from "../src/core/services/MobIdentificationServiceV2.js";

console.log("\n🧪 Testing Database-Backed Mob Identification\n");

const service = new MobIdentificationServiceV2("./data/entropia.db");

// Test 1: Find mobs by health (650 HP = Atrox Young)
console.log("Test 1: Find mobs with ~650 HP");
const healthTest = {
  totalDamage: 650,
  totalShots: 20,
  hits: 18,
  misses: 2,
  criticals: 1,
  dodges: 0,
  evades: 0,
  timeToKill: 15000,
  estimatedHealth: 650,
  accuracy: 0.9,
  criticalRate: 0.05,
  location: { lon: 78872, lat: 67998 }, // Your actual hunting location
};

const result1 = service.identifyMob(healthTest);
if (result1) {
  console.log(`✅ Identified: ${result1.identifiedMob}`);
  console.log(`   Species: ${result1.species}`);
  console.log(`   Maturity: ${result1.maturity}`);
  console.log(`   HP: ${result1.hp}`);
  console.log(`   Distance: ${result1.distance.toFixed(0)}m from spawn`);
  console.log(`   Confidence: ${(result1.confidence * 100).toFixed(0)}%`);
  console.log(`   Reasoning: ${result1.reasoning.join(" | ")}`);
} else {
  console.log("❌ No match found");
}

// Test 2: Different location (should get different mob)
console.log("\n\nTest 2: Same HP but different location (65000, 70000)");
const healthTest2 = {
  ...healthTest,
  estimatedHealth: 650,
  location: { lon: 65000, lat: 70000 }, // Different zone
};

const result2 = service.identifyMob(healthTest2);
if (result2) {
  console.log(`✅ Identified: ${result2.identifiedMob}`);
  console.log(`   Species: ${result2.species}`);
  console.log(`   Distance: ${result2.distance.toFixed(0)}m from spawn`);
  console.log(`   Confidence: ${(result2.confidence * 100).toFixed(0)}%`);
} else {
  console.log("❌ No match found");
}

// Test 3: With loot validation
console.log("\n\nTest 3: 650 HP + location + loot items");
const result3 = service.identifyMob(healthTest, [
  "Atrox Hide",
  "Animal Oil Residue",
]);
if (result3) {
  console.log(`✅ Identified: ${result3.identifiedMob}`);
  console.log(`   Confidence: ${(result3.confidence * 100).toFixed(0)}%`);
  console.log(`   Reasoning: ${result3.reasoning.join(" | ")}`);
} else {
  console.log("❌ No match found");
}

service.close();
console.log("\n✅ Database tests complete!\n");
