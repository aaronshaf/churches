import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { affiliations } from '../src/db/schema';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const affiliationData = [
  { name: 'Alpine Church', website: 'https://alpinechurch.org/' },
  { name: 'American Baptist Churches USA', website: 'https://www.abc-usa.org/' },
  { name: 'Anglican Church in North America', website: 'https://www.acna.org/' },
  { name: 'Arch Ministries', website: 'https://archmin.org/' },
  { name: 'Assemblies of God', website: 'https://ag.org/' },
  { name: 'Beachy Amish Mennonite Fellowship', website: 'https://gameo.org/index.php?title=Beachy_Amish_Mennonite_Fellowship' },
  { name: 'Biblical Ministries Worldwide', website: 'https://biblicalministries.org/' },
  { name: 'Calvary Chapel Association', website: 'https://calvarycca.org/' },
  { name: 'Calvary Global Network', website: 'https://cgn.org/' },
  { name: 'Christian and Missionary Alliance', website: 'https://cmalliance.org/' },
  { name: 'Christian Reformed Church', website: 'https://www.crcna.org/' },
  { name: 'Church of God of Prophecy', website: 'https://cogop.org/' },
  { name: 'Color Country Baptist Association', website: 'https://www.ccbasbc.org/' },
  { name: 'Converge Rocky Mountain', website: 'https://www.convergerockymountain.org/' },
  { name: 'Evangelical Free Church of America', website: 'https://www.efca.org/' },
  { name: 'Evangelical Lutheran Church in America', website: 'https://www.elca.org/' },
  { name: 'Evangelical Lutheran Synod', website: 'https://www.els.org/' },
  { name: 'Fellowship of Independent Reformed Evangelicals', website: 'https://www.firefellowship.org/' },
  { name: 'Foursquare Church', website: 'https://www.foursquare.org/' },
  { name: 'Frontier School of the Bible', website: 'https://www.frontierbible.org/' },
  { name: 'G3 Church Network', website: 'https://g3min.org/g3-church-network/' },
  { name: 'General Association of Regular Baptist Churches', website: 'https://www.garbc.org/' },
  { name: 'Gideon Baptist Association', website: 'https://uisbc.org/churches-associations/' },
  { name: 'Golden Spike Baptist Network', website: 'https://goldenspikebaptistnetwork.com/' },
  { name: 'Grace Advance', website: 'https://graceadvance.org/' },
  { name: 'Grace Reformed Network', website: 'https://gracereformednetwork.org/' },
  { name: 'IFCA International', website: 'https://www.ifca.org/' },
  { name: 'Intermountain Church Planters Association', website: 'https://intermountainchurchplanters.com/' },
  { name: 'International Church of the Nazarene', website: 'https://icnazarene.com/' },
  { name: 'Lutheran Church Missouri Synod', website: 'https://www.lcms.org/' },
  { name: 'Lutheran Congregations in Mission for Christ', website: 'https://www.lcmc.net/' },
  { name: 'M28 Alliance', website: 'https://www.m28alliance.com/' },
  { name: 'National Baptist Convention', website: 'https://www.nationalbaptist.com/' },
  { name: 'Nationwide Fellowship Churches', website: 'https://gameo.org/index.php?title=Nationwide_Fellowship_Churches' },
  { name: 'North American Baptist Conference', website: 'https://nabconference.org/' },
  { name: 'Northwest Baptist Missions', website: 'https://www.nbmwest.org/' },
  { name: 'Orthodox Presbyterian Church', website: 'https://opc.org/' },
  { name: 'Plant for the Gospel', website: 'https://www.plant4thegospel.com/' },
  { name: 'Plant Utah', website: 'https://plantutah.com/' },
  { name: 'Potter\'s House Christian Fellowship', website: 'https://www.prescottpottershouse.com/' },
  { name: 'Presbyterian Church (U.S.A.)', website: 'https://www.pcusa.org/' },
  { name: 'Presbyterian Church in America', website: 'https://pcanet.org/' },
  { name: 'Protestant Episcopal Church in the United States of America', website: 'https://www.episcopalchurch.org/' },
  { name: 'Salt Lake Baptist Association', website: 'https://slba.org/' },
  { name: 'Send Network', website: 'https://www.namb.net/send-network/' },
  { name: 'Southern Baptist Convention', website: 'https://www.sbc.net/' },
  { name: 'Southern Nevada Baptist Association', website: 'https://www.snba.net/' },
  { name: 'Tentmakers Bible Mission', website: 'https://tentmakersbiblemission.org/' },
  { name: 'The Antioch Movement', website: 'https://antioch.org/' },
  { name: 'The Pillar Network', website: 'https://thepillarnetwork.com/' },
  { name: 'U.S. Conference of Mennonite Brethren Churches', website: 'https://usmb.org/' },
  { name: 'United Church of Christ', website: 'https://www.ucc.org/' },
  { name: 'United Methodist Church', website: 'https://www.umc.org/' },
  { name: 'Utah Idaho Southern Baptist Convention', website: 'https://uisbc.org/' },
  { name: 'Venture Church Network', website: 'https://venturechurches.org/' },
  { name: 'Wisconsin Evangelical Lutheran Synod', website: 'https://wels.net/' },
];

async function seedAffiliations() {
  // Try to load from .dev.vars if env vars not set
  let dbUrl = process.env.TURSO_DATABASE_URL;
  let authToken = process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl || !authToken) {
    try {
      const devVarsPath = path.join(__dirname, '..', '.dev.vars');
      const devVars = fs.readFileSync(devVarsPath, 'utf-8');
      const lines = devVars.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('TURSO_DATABASE_URL=')) {
          dbUrl = line.split('=')[1].trim();
        } else if (line.startsWith('TURSO_AUTH_TOKEN=')) {
          authToken = line.split('=')[1].trim();
        }
      }
    } catch (error) {
      console.error('Could not read .dev.vars file');
    }
  }

  if (!dbUrl || !authToken) {
    console.error('Missing database credentials');
    process.exit(1);
  }

  const client = createClient({
    url: dbUrl,
    authToken: authToken,
  });

  const db = drizzle(client);

  console.log('Seeding affiliations...');

  for (const affiliation of affiliationData) {
    try {
      // Check if affiliation already exists
      const existing = await db.select()
        .from(affiliations)
        .where(sql`${affiliations.name} = ${affiliation.name}`)
        .get();

      if (existing) {
        // Update existing affiliation
        await db.update(affiliations)
          .set({ website: affiliation.website })
          .where(sql`${affiliations.name} = ${affiliation.name}`);
        console.log(`Updated: ${affiliation.name}`);
      } else {
        // Insert new affiliation
        await db.insert(affiliations).values({
          name: affiliation.name,
          website: affiliation.website,
          publicNotes: null,
          privateNotes: null,
        });
        console.log(`Added: ${affiliation.name}`);
      }
    } catch (error) {
      console.error(`Error processing ${affiliation.name}:`, error);
    }
  }

  console.log('Affiliation seeding complete!');
  process.exit(0);
}

seedAffiliations();