/**
 * Map Utilities for ARTEMIS
 * 
 * Coordinate conversion and map calculations for Entropia Universe Calypso planet.
 * Algorithm details: Converts game coordinates (0-163840) to pixel coordinates (0-4608)
 */

import { Coordinate } from '../types/GPS';

export const CALYPSO_CONFIG = {
  PLANET_WIDTH: 163840,
  PLANET_HEIGHT: 163840,
  IMAGE_WIDTH: 4608,
  IMAGE_HEIGHT: 4608,
  COORDINATE_MULTIPLIER: 2.223,
  OFFSET_X: -0.2223,
  OFFSET_Y: 0.333,
  MAP_IMAGE: '/calypso-map.webp'
};

/**
 * Convert game coordinates to pixel coordinates on the map image
 * @param gameX - Game X coordinate (Longitude)
 * @param gameY - Game Y coordinate (Latitude)
 * @returns Pixel coordinates { x, y }
 */
export function coordsToPixels(gameX: number, gameY: number): { x: number; y: number } {
  // Apply multiplier FIRST, then normalize to image dimensions
  const planetX = gameX * CALYPSO_CONFIG.COORDINATE_MULTIPLIER;
  const planetY = gameY * CALYPSO_CONFIG.COORDINATE_MULTIPLIER;

  let x = (planetX / CALYPSO_CONFIG.PLANET_WIDTH) * CALYPSO_CONFIG.IMAGE_WIDTH;
  let y = CALYPSO_CONFIG.IMAGE_HEIGHT - (planetY / CALYPSO_CONFIG.PLANET_HEIGHT) * CALYPSO_CONFIG.IMAGE_HEIGHT;

  // Apply calibration offsets
  x += CALYPSO_CONFIG.OFFSET_X * CALYPSO_CONFIG.IMAGE_WIDTH;
  y += CALYPSO_CONFIG.OFFSET_Y * CALYPSO_CONFIG.IMAGE_HEIGHT;

  return { x, y };
}

/**
 * Convert pixel coordinates back to game coordinates
 * @param pixelX - Pixel X coordinate
 * @param pixelY - Pixel Y coordinate
 * @returns Game coordinates { x, y }
 */
export function pixelsToCoords(pixelX: number, pixelY: number): { x: number; y: number } {
  // Remove calibration offsets
  let x = pixelX - CALYPSO_CONFIG.OFFSET_X * CALYPSO_CONFIG.IMAGE_WIDTH;
  let y = pixelY - CALYPSO_CONFIG.OFFSET_Y * CALYPSO_CONFIG.IMAGE_HEIGHT;

  // Convert from image dimensions to planet coordinates
  const planetX = (x / CALYPSO_CONFIG.IMAGE_WIDTH) * CALYPSO_CONFIG.PLANET_WIDTH;
  const planetY = ((CALYPSO_CONFIG.IMAGE_HEIGHT - y) / CALYPSO_CONFIG.IMAGE_HEIGHT) * CALYPSO_CONFIG.PLANET_HEIGHT;

  // Apply inverse multiplier
  const gameX = planetX / CALYPSO_CONFIG.COORDINATE_MULTIPLIER;
  const gameY = planetY / CALYPSO_CONFIG.COORDINATE_MULTIPLIER;

  return { x: Math.round(gameX), y: Math.round(gameY) };
}

/**
 * Calculate distance between two coordinates in meters
 */
export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const dx = coord2.lon - coord1.lon;
  const dy = coord2.lat - coord1.lat;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate center point of multiple coordinates
 */
export function calculateCenter(coords: Coordinate[]): Coordinate | null {
  if (coords.length === 0) return null;
  
  const sum = coords.reduce(
    (acc, coord) => ({
      lon: acc.lon + coord.lon,
      lat: acc.lat + coord.lat
    }),
    { lon: 0, lat: 0 }
  );
  
  return {
    lon: sum.lon / coords.length,
    lat: sum.lat / coords.length
  };
}

/**
 * Check if a coordinate is within a circular zone
 */
export function isWithinZone(
  coord: Coordinate,
  zoneCenter: Coordinate,
  zoneRadius: number
): boolean {
  return calculateDistance(coord, zoneCenter) <= zoneRadius;
}

/**
 * Cluster nearby kills into groups
 * Returns clusters with center point and radius encompassing all kills
 */
export interface KillCluster {
  center: Coordinate;
  radius: number;
  kills: Array<{ location: Coordinate; mobName: string; timestamp: number }>;
}

export function clusterKills(
  kills: Array<{ location: Coordinate; mobName: string; timestamp: number }>,
  maxDistance: number = 500, // Maximum distance to group kills (in game units)
  minRadius: number = 50 // Minimum cluster radius for visibility
): KillCluster[] {
  if (kills.length === 0) return [];

  const clusters: KillCluster[] = [];
  const used = new Set<number>();

  kills.forEach((kill, idx) => {
    if (used.has(idx)) return;

    // Start new cluster
    const clusterKills = [kill];
    used.add(idx);

    // Find nearby kills
    kills.forEach((otherKill, otherIdx) => {
      if (used.has(otherIdx)) return;
      
      const distance = calculateDistance(kill.location, otherKill.location);
      if (distance <= maxDistance) {
        clusterKills.push(otherKill);
        used.add(otherIdx);
      }
    });

    // Calculate cluster center
    const center = calculateCenter(clusterKills.map(k => k.location));
    if (!center) return;

    // Calculate radius (distance to furthest kill from center)
    const radius = Math.max(
      ...clusterKills.map(k => calculateDistance(center, k.location)),
      minRadius // User-configurable minimum radius
    );

    clusters.push({ center, radius, kills: clusterKills });
  });

  return clusters;
}
