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
    // Database connection logic
    const r2Key = Deno.env.get("R2_WRITE_SECRET_ACCESS_KEY");
    let username = "app_reader";
    let password = "ca35a0d8bd31d0d5";

    if (r2Key) {
      password = r2Key.slice(0, 14);
      username = "writer_user2";
    }

    const databaseUrl = Deno.env.get("DATABASE_URL") || 
      `postgresql://${username}:${password}@database-1.clo608s4ivev.us-east-1.rds.amazonaws.com:5432/postgres`;

    const client = new Client(databaseUrl);
    await client.connect();

    // Query for models data - you'll need to adjust these queries based on your actual table structure
    const modelsQuery = `
      SELECT 
        uid,
        score,
        epochs,
        last_updated,
        status,
        daily_rollouts,
        environment
      FROM models 
      ORDER BY score DESC
    `;

    const environmentsQuery = `
      SELECT DISTINCT 
        environment as id,
        environment as name,
        COUNT(*) as model_count
      FROM models 
      GROUP BY environment
    `;

    const modelsResult = await client.queryArray(modelsQuery);
    const environmentsResult = await client.queryArray(environmentsQuery);

    // Transform data to match frontend expectations
    const models = modelsResult.rows.map((row: any[]) => ({
      uid: row[0],
      score: parseFloat(row[1]) || 0,
      epochs: parseInt(row[2]) || 0,
      last_updated: row[3] || new Date().toISOString(),
      status: row[4] || 'idle',
      daily_rollouts: parseInt(row[5]) || 0,
      environment: row[6] || 'unknown'
    }));

    const environments = environmentsResult.rows.map((row: any[]) => ({
      id: row[0],
      name: row[0],
      description: getEnvironmentDescription(row[0]),
      repoUrl: `https://github.com/affine-subnet/${row[0].toLowerCase()}-env`,
      models: models.filter(m => m.environment === row[0])
    }));

    await client.end();

    return new Response(
      JSON.stringify({ 
        success: true, 
        environments,
        models 
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
        error: error.message 
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
    'SAT': 'Satellite tracking and control environment',
    'ABD': 'Autonomous behavior detection system', 
    'DED': 'Dynamic environment detection',
    'ELR': 'Enhanced learning and reasoning'
  };
  
  return descriptions[envName.toUpperCase()] || `${envName} environment for reinforcement learning`;
}