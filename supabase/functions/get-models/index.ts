import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Database connection logic based on your configuration
    const r2Key = Deno.env.get("R2_WRITE_SECRET_ACCESS_KEY");
    let username = "app_reader";
    let password = "ca35a0d8bd31d0d5";

    if (r2Key) {
      password = r2Key.slice(0, 14);
      username = "writer_user2";
    }

    const databaseUrl = Deno.env.get("DATABASE_URL") || 
      `postgresql://${username}:${password}@database-1.clo608s4ivev.us-east-1.rds.amazonaws.com:5432/postgres`;

    const client = new Client({ 
      connection: databaseUrl, 
      ssl: { enforce: true, tls: { allowUnverifiedCertificates: true } } 
    });
    await client.connect();

    // Query for miner leaderboard data grouped by hotkey and model
    const minersQuery = `
      SELECT
          hotkey,
          MAX(uid) AS last_seen_uid,
          model,
          revision,
          env_name,
          COUNT(*) AS total_rollouts,
          AVG(score) AS average_score,
          (SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*)) * 100 AS success_rate_percent,
          AVG(latency_seconds) as avg_latency,
          MAX(ingested_at) as last_updated,
          COUNT(CASE WHEN ingested_at >= NOW() - INTERVAL '1 day' THEN 1 END) as daily_rollouts,
          MAX(miner_block) as miner_block,
          COUNT(CASE WHEN ingested_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as recent_activity
      FROM
          public.affine_results
      WHERE 
          ingested_at >= NOW() - INTERVAL '7 days'  -- Focus on recent data
      GROUP BY
          hotkey, model, revision, env_name
      ORDER BY
          average_score DESC, total_rollouts DESC;
    `;

    // Query for environment information
    const environmentsQuery = `
      SELECT 
          env_name,
          env_version,
          COUNT(DISTINCT hotkey) as unique_miners,
          COUNT(*) as total_rollouts,
          AVG(score) as avg_score,
          MAX(ingested_at) as last_activity
      FROM public.affine_results 
      WHERE ingested_at >= NOW() - INTERVAL '7 days'
      GROUP BY env_name, env_version
      ORDER BY env_name;
    `;

    const minersResult = await client.queryArray(minersQuery);
    const environmentsResult = await client.queryArray(environmentsQuery);

    // Transform miners data to match frontend expectations
    const miners = minersResult.rows.map((row: any[]) => ({
      uid: row[1]?.toString() || 'unknown', // last_seen_uid
      hotkey: row[0], // primary identifier
      model: row[2] || 'unknown',
      revision: row[3] || 'v1.0',
      environment: row[4] || 'unknown',
      total_rollouts: parseInt(row[5]) || 0,
      score: parseFloat(row[6]) || 0,
      success_rate: parseFloat(row[7]) || 0,
      avg_latency: parseFloat(row[8]) || 0,
      last_updated: row[9] || new Date().toISOString(),
      daily_rollouts: parseInt(row[10]) || 0,
      miner_block: parseInt(row[11]) || 0,
      recent_activity: parseInt(row[12]) || 0,
      // Determine status based on recent activity
      status: parseInt(row[12]) > 0 ? 'training' : 'idle',
      // Calculate epochs approximation from total rollouts
      epochs: Math.floor((parseInt(row[5]) || 0) / 100) // Rough estimate
    }));

    // Transform environments data
    const environments = environmentsResult.rows.map((row: any[]) => {
      const envName = row[0];
      const envMiners = miners.filter(m => m.environment === envName);
      
      return {
        id: envName.toLowerCase(),
        name: envName,
        description: getEnvironmentDescription(envName),
        repoUrl: `https://github.com/affine-subnet/${envName.toLowerCase()}-env`,
        models: envMiners,
        stats: {
          unique_miners: parseInt(row[2]) || 0,
          total_rollouts: parseInt(row[3]) || 0,
          avg_score: parseFloat(row[4]) || 0,
          last_activity: row[5] || new Date().toISOString()
        }
      };
    });

    await client.end();

    return new Response(
      JSON.stringify({ 
        success: true, 
        environments,
        models: miners,
        total_miners: miners.length,
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      },
    );

  } catch (error) {
    console.error('Database error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      },
    );
  }
});

function getEnvironmentDescription(envName: string): string {
  const descriptions: { [key: string]: string } = {
    'SAT': 'Satellite tracking and orbital mechanics environment',
    'ABD': 'Autonomous behavior detection and classification', 
    'DED': 'Dynamic environment detection and adaptation',
    'ELR': 'Enhanced learning and reasoning capabilities',
    'MATH': 'Mathematical problem solving and computation',
    'LOGIC': 'Logical reasoning and inference tasks'
  };
  
  return descriptions[envName.toUpperCase()] || `${envName} reinforcement learning environment`;
}</parameter>