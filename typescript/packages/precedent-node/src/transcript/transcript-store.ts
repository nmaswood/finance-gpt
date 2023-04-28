import { EarningsCallHref, Transcript } from "@fgpt/precedent-iso";
import { DatabasePool, sql } from "slonik";
import { z } from "zod";

export class PsqlTranscriptStore implements TranscriptStore {
  constructor(private readonly pool: DatabasePool) {}

  async upsertHref({
    tickers,
    quarter,
    year,
    href,
  }: EarningsCallHref): Promise<void> {
    return this.pool.connect(async (cnx) => {
      await cnx.query(
        sql.unsafe`
INSERT INTO transcript_href(href, year, quarter, ticker, allTickers) VALUES (${href}, ${year}, ${quarter}, ${
          tickers[0] ?? null
        }, ${JSON.stringify(tickers)})

ON CONFLICT (href)
    DO NOTHING;
`
      );
    });
  }

  async *unprocessedHrefs(): AsyncIterable<HrefToProcess> {
    let lastId: string | undefined = undefined;
    while (true) {
      const rows = await this.pool.connect(async (cnx) => {
        const response = await cnx.query(
          sql.type(ZHrefToProcess)`
SELECT id, href FROM
transcript_href 
${
  lastId === undefined
    ? sql.fragment`WHERE TRUE`
    : sql.fragment` WHERE id > ${lastId}`
} AND 

NOT EXISTS (SELECT 1 FROM transcript_content WHERE transcript_href.id = transcript_content.href_id)

          ORDER BY id ASC LIMIT 1;`
        );

        return response.rows;
      });
      if (rows.length === 0) {
        return;
      }

      yield* rows;
      const lastIdFromRows = rows.at(-1)?.id;
      if (lastIdFromRows === undefined) {
        throw new Error("illegal state");
      }
      lastId = lastIdFromRows;
    }
  }

  storeTranscript(transcriptId: string, { blocks }: Transcript): Promise<void> {
    return this.pool.connect(async (cnx) => {
      await cnx.query(
        sql.unsafe`
INSERT INTO transcript_content(href_id, content) VALUES (
  ${transcriptId},
  ${JSON.stringify(blocks)}
)
ON CONFLICT (href_id)
DO NOTHING;
`
      );
    });
  }
}

const ZHrefToProcess = z.object({
  id: z.string(),
  href: z.string(),
});

type HrefToProcess = z.infer<typeof ZHrefToProcess>;

export interface TranscriptStore {
  upsertHref(body: EarningsCallHref): Promise<void>;
  unprocessedHrefs(): AsyncIterable<HrefToProcess>;
  storeTranscript(href: string, body: Transcript): Promise<void>;
}
