import { TestBed } from '@angular/core/testing';
import { Action, ActionReducer } from '@ngrx/store';

import { EntityAction } from '../actions/entity-action';
import { EntityActionFactory } from '../actions/entity-action-factory';
import { EntityCache } from './entity-cache';
import { EntityCacheReducerFactory } from './entity-cache-reducer-factory';
import { EntityCacheQuerySet, MergeQuerySet, SetEntityCache } from '../actions/entity-cache-action';
import { EntityCollection } from './entity-collection';
import { EntityCollectionCreator } from './entity-collection-creator';
import { EntityCollectionReducerFactory } from './entity-collection-reducer';
import { EntityCollectionReducerMethodsFactory } from './entity-collection-reducer-methods';
import { EntityCollectionReducerRegistry } from './entity-collection-reducer-registry';
import { EntityDefinitionService } from '../entity-metadata/entity-definition.service';
import { EntityMetadataMap, ENTITY_METADATA_TOKEN } from '../entity-metadata/entity-metadata';
import { EntityOp } from '../actions/entity-op';
import { IdSelector } from '../utils/ngrx-entity-models';
import { Logger } from '../utils/interfaces';

class Hero {
  id: number;
  name: string;
  power?: string;
}
class Villain {
  key: string;
  name: string;
}

const metadata: EntityMetadataMap = {
  Hero: {},
  Villain: { selectId: (villain: Villain) => villain.key }
};

describe('EntityCacheReducer', () => {
  let collectionCreator: EntityCollectionCreator;
  let entityActionFactory: EntityActionFactory;
  let entityCacheReducer: ActionReducer<EntityCache, Action>;

  beforeEach(() => {
    entityActionFactory = new EntityActionFactory();
    const logger = jasmine.createSpyObj('Logger', ['error', 'log', 'warn']);

    TestBed.configureTestingModule({
      providers: [
        EntityCacheReducerFactory,
        EntityCollectionCreator,
        {
          provide: EntityCollectionReducerMethodsFactory,
          useClass: EntityCollectionReducerMethodsFactory
        },
        EntityCollectionReducerFactory,
        EntityCollectionReducerRegistry,
        EntityDefinitionService,
        { provide: ENTITY_METADATA_TOKEN, multi: true, useValue: metadata },
        { provide: Logger, useValue: logger }
      ]
    });

    collectionCreator = TestBed.get(EntityCollectionCreator);
    const entityCacheReducerFactory = TestBed.get(EntityCacheReducerFactory) as EntityCacheReducerFactory;
    entityCacheReducer = entityCacheReducerFactory.create();
  });

  describe('#create', () => {
    it('creates a default hero reducer when QUERY_ALL for hero', () => {
      const hero: Hero = { id: 42, name: 'Bobby' };
      const action = entityActionFactory.create<Hero>('Hero', EntityOp.ADD_ONE, hero);

      const state = entityCacheReducer({}, action);
      const collection = state['Hero'];
      expect(collection.ids.length).toBe(1, 'should have added one');
      expect(collection.entities[42]).toEqual(hero, 'should be added hero');
    });

    it('throws when ask for reducer of unknown entity type', () => {
      const action = entityActionFactory.create('Foo', EntityOp.QUERY_ALL);
      expect(() => entityCacheReducer({}, action)).toThrowError(/no EntityDefinition/i);
    });
  });

  /**
   * Test the EntityCache-level actions, SET and MERGE, which can
   * be used to restore the entity cache from a know state such as
   * re-hydrating from browser storage.
   * Useful for an offline-capable app.
   */
  describe('EntityCache-level actions', () => {
    let initialHeroes: Hero[];
    let initialCache: EntityCache;

    beforeEach(() => {
      initialHeroes = [{ id: 2, name: 'B', power: 'Fast' }, { id: 1, name: 'A', power: 'invisible' }];
      initialCache = createInitialCache({ Hero: initialHeroes });
    });

    describe('ENTITY_CACHE_SET', () => {
      it('should initialize cache', () => {
        const cache = createInitialCache({
          Hero: initialHeroes,
          Villain: [{ key: 'DE', name: 'Dr. Evil' }]
        });

        const action = new SetEntityCache(cache);
        // const action = {  // equivalent
        //   type: SET_ENTITY_CACHE,
        //   payload: cache
        // };

        const state = entityCacheReducer(cache, action);
        expect(state['Hero'].ids).toEqual([2, 1], 'Hero ids');
        expect(state['Hero'].entities).toEqual({
          1: initialHeroes[1],
          2: initialHeroes[0]
        });
        expect(state['Villain'].ids).toEqual(['DE'], 'Villain ids');
      });

      it('should clear the cache when set with empty object', () => {
        const action = new SetEntityCache({});
        const state = entityCacheReducer(initialCache, action);
        expect(Object.keys(state)).toEqual([]);
      });

      it('should replace prior cache with new cache', () => {
        const priorCache = createInitialCache({
          Hero: initialHeroes,
          Villain: [{ key: 'DE', name: 'Dr. Evil' }]
        });

        const newHeroes = [{ id: 42, name: 'Bobby' }];
        const newCache = createInitialCache({ Hero: newHeroes });

        const action = new SetEntityCache(newCache);
        const state = entityCacheReducer(priorCache, action);
        expect(state['Villain']).toBeUndefined('No villains');

        const heroCollection = state['Hero'];
        expect(heroCollection.ids).toEqual([42], 'hero ids');
        expect(heroCollection.entities[42]).toEqual(newHeroes[0], 'heroes');
      });
    });

    describe('ENTITY_CACHE_QUERY_SET_MERGE', () => {
      function shouldHaveExpectedHeroes(entityCache: EntityCache) {
        expect(entityCache['Hero'].ids).toEqual([2, 1], 'Hero ids');
        expect(entityCache['Hero'].entities).toEqual({
          1: initialHeroes[1],
          2: initialHeroes[0]
        });
      }

      it('should initialize an empty cache with query set', () => {
        const querySet: EntityCacheQuerySet = {
          Hero: initialHeroes,
          Villain: [{ key: 'DE', name: 'Dr. Evil' }]
        };

        const action = new MergeQuerySet(querySet);

        const state = entityCacheReducer({}, action);
        shouldHaveExpectedHeroes(state);
        expect(state['Villain'].ids).toEqual(['DE'], 'Villain ids');
      });

      it('should return cache matching existing cache when query set is empty', () => {
        const action = new MergeQuerySet({});
        const state = entityCacheReducer(initialCache, action);
        shouldHaveExpectedHeroes(state);
      });

      it('should add a new collection to existing cache', () => {
        const querySet: EntityCacheQuerySet = {
          Villain: [{ key: 'DE', name: 'Dr. Evil' }]
        };
        const action = new MergeQuerySet(querySet);
        const state = entityCacheReducer(initialCache, action);
        shouldHaveExpectedHeroes(state);
        expect(state['Villain'].ids).toEqual(['DE'], 'Villain ids');
      });

      it('should merge into an existing cached collection', () => {
        const querySet: EntityCacheQuerySet = {
          Hero: [{ id: 42, name: 'Bobby' }]
        };
        const action = new MergeQuerySet(querySet);
        const state = entityCacheReducer(initialCache, action);
        const heroCollection = state['Hero'];
        const expectedIds = initialHeroes.map(h => h.id).concat(42);
        expect(heroCollection.ids).toEqual(expectedIds, 'merged ids');
        expect(heroCollection.entities[42]).toEqual({ id: 42, name: 'Bobby' }, 'merged hero');
      });
    });
  });

  // #region helpers
  function createCollection<T = any>(entityName: string, data: T[], selectId: IdSelector<any>) {
    return {
      ...collectionCreator.create<T>(entityName),
      ids: data.map(e => selectId(e)) as string[] | number[],
      entities: data.reduce(
        (acc, e) => {
          acc[selectId(e)] = e;
          return acc;
        },
        {} as any
      )
    } as EntityCollection<T>;
  }

  function createInitialCache(entityMap: { [entityName: string]: any[] }) {
    const cache: EntityCache = {};
    // tslint:disable-next-line:forin
    for (const entityName in entityMap) {
      const selectId = metadata[entityName].selectId || ((entity: any) => entity.id);
      cache[entityName] = createCollection(entityName, entityMap[entityName], selectId);
    }

    return cache;
  }
  // #endregion helpers
});
