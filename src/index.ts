import { InitProps, CacheItem } from '../index';
import { EventEmitter } from 'events';

// Check if the item is alive || Not expired yet/ever
const alive = (ttl: boolean | number) => ttl === false || ttl > Date.now();

const defineExpire = (expire: any) => {
  if (expire === undefined) return false;
  return (expire !== null && !isNaN(expire) && expire > 0);
};

class V_Core_Cache extends EventEmitter {
  private clInt: any = null;
  purge: () => Promise<boolean>;
  count: () => Promise<number>;
  getAll: () => Promise<Map<any, any>>;
  get: (key: string | number) => Promise<any>;
  getSync: (key: string | number) => any;
  getExpire: (key: string | number) => Promise<any>;
  set: (key: string | number, value: any, exp?: number) => Promise<boolean>;
  setSync: (key: string | number, value: any, exp?: number) => boolean;
  del: (key: string | number) => Promise<boolean>;
  delSync: (key: any) => boolean;
  has: (key: string | number) => Promise<boolean>;
  cleanup: () => Promise<number>;
  keys: () => Promise<IterableIterator<any>>;
  size: () => Promise<number>;
  stats: () => Promise<{ hits: number; misses: number; count: number; size: number; }>;
  statsSync: () => { hits: number; misses: number; count: number; size: number; };
  purgeStats: () => Promise<{ hits: number; misses: number; count: number; size: number; }>;
  values: () => Promise<IterableIterator<any>>;
  entries: () => Promise<IterableIterator<[any, any]>>;
  stopCleanup: () => Promise<boolean>;
  countSync: () => number;
  sizeSync: () => number;

  constructor(init: InitProps = {}) {
    super();

    let hits = 0;
    let miss = 0;

    const cleanInterval = init.cleanInterval || false;

    let defExp = defineExpire(init.expires) ? init.expires : null;
    let $ = new Map();


    //* Cache Items Count
    this.count = async () => $.size;
    this.countSync = () => $.size;


    //* All
    this.getAll = async () => $;


    //? Get Item
    this.getSync = (key) => {
      let data = $.get(key);

      let value = data !== undefined ? data.value : undefined;

      this.emit("get", { key, value });


      if (value !== undefined) {
        if (alive(data.exp)) {
          hits++;
          this.emit("hit", { key, value });
          return value;
        }
        $.delete(key);
      }

      miss++;
      this.emit("miss", { key: key });
      return undefined;

    };

    this.get = async (key) => this.getSync(key);


    //? Get Item Expire Time
    this.getExpire = async (key) => $.has(key) !== false ? $.get(key).exp : undefined;


    //? Set Item Value & Expire Time
    this.setSync = (key, value, exp = defExp) => {
      $.set(key, {
        value: value,
        exp: typeof exp === "number" ? Date.now() + exp : false,
      });
      this.emit("set", { key, value });
      return true;
    };

    this.set = async (key, value, exp = defExp) => this.setSync(key, value, exp);


    //? Delete / Remove item from cache
    this.del = async (key) => $.delete(key);
    this.delSync = (key) => $.delete(key);

    //? Check if has
    this.has = async (key) => {
      let data = $.get(key);
      return data != undefined ? alive(data.exp) : false;
    };


    //! PURGE Cache
    this.purge = async () => {
      if ((await this.count()) === 0) {
        this.emit("purge", false);
        return false;
      }

      $.clear();
      let rez = (await this.count()) === 0;
      this.emit("purge", rez);
      return rez;
    };

    this.cleanup = async () => {
      let affected = 0;
      for (let key of await this.keys()) {
        if (!alive($.get(key).exp)) {
          $.delete(key);
          affected++;
        }
      }
      return affected;
    };


    //? Size Aproximation
    this.size = async () => new TextEncoder().encode(JSON.stringify(Array.from($.entries()))).length;
    this.sizeSync = () => new TextEncoder().encode(JSON.stringify(Array.from($.entries()))).length;


    //? Stats
    this.stats = async () => {
      return {
        hits: hits,
        misses: miss,
        count: await this.count(),
        size: await this.size(),
      };
    };
    this.statsSync = () => {
      return {
        hits: hits,
        misses: miss,
        count: this.countSync(),
        size: this.sizeSync(),
      };
    };

    //? PurgeStats
    this.purgeStats = async () => {
      hits = 0;
      miss = 0;

      let stats = await this.stats();
      this.emit("purge_stats", stats);
      return stats;
    };


    //? KEYS
    this.keys = async () => $.keys();


    //? VALUES
    this.values = async () => $.values();


    //? ENTRIES
    this.entries = async () => $.entries();


    //! End the cleanup interval looping
    this.stopCleanup = async () => {
      if (this.clInt !== null) {
        clearInterval(this.clInt);
        this.clInt = null;
        return true;
      }
      return false;
    };

    //? Start Cleanup Interval if set.
    if (cleanInterval !== false) {
      this.clInt = setInterval(this.cleanup, cleanInterval);
    }

  }

};


const createCache = (props: InitProps): V_Core_Cache => new V_Core_Cache(props);

module.exports = {
  V_Core_Cache,
  createCache,
}